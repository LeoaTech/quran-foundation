require('dotenv').config();

const xlsx = require('xlsx');
const studentImportQueue = require('../jobs/studentImport');
const profileImageQueue = require('../jobs/profileImage');
const db = require('../db/knex');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateTempPassword() {
  return `Qf${crypto.randomBytes(4).toString('hex')}`;
}

function extractVal(row, keys) {
  for (const k of keys) {
    const targetKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === targetKey) {
        if (row[key] !== undefined && row[key] !== null) {
          const str = String(row[key]).trim();
          if (str.length > 0) return str;
        }
      }
    }
  }
  return null;
}

/**
 * Parse MM-DD-YYYY → YYYY-MM-DD (ISO) for DB storage.
 * Returns null if parsing fails.
 */
function parseDateMMDDYYYY(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  // Try MM-DD-YYYY
  const match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, mm, dd, yyyy] = match;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }
  // Fallback: try as-is (already ISO or other parseable format)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

/**
 * Flexibly parse boolean values (is_Minor) from Excel/CSV cells.
 * Accepts: true, 1, '1', 'true', 'TRUE', 'yes', 'y', 't' -> true
 * Accepts: false, 0, '0', 'false', 'FALSE', 'no', 'n', 'f', '', null, undefined -> false
 */
function parseBoolean(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val === null || val === undefined || val === '') return false;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 't';
}

/**
 * Classify whether an error is fatal (infrastructure down) or a row error.
 * Fatal errors cause the job to throw, triggering Bull's retry mechanism.
 */
function isFatalError(err) {
  if (err.message?.includes('ECONNREFUSED')) return true;
  if (err.message?.includes('ENOTFOUND')) return true;
  if (err.code === '57P01') return true;  // pg admin shutdown
  if (err.code === '57P03') return true;  // pg cannot connect
  if (err.code === '53300') return true;  // too many connections
  return false;
}

/**
 * Log a row-level error to import_errors and increment the job error counter.
 */
async function logRowError(importJobId, { sheetName, rowNumber, studentRef, studentName, phone, errorMessage, rowData }) {
  await db('import_errors').insert({
    import_job_id: importJobId,
    sheet_name: sheetName,
    row_number: rowNumber,
    student_ref: studentRef || null,
    student_name: studentName || null,
    phone: phone || null,
    error_message: errorMessage,
    row_data: rowData ? JSON.stringify(rowData) : null,
  });
  await db('import_jobs').where({ id: importJobId }).increment('error_count', 1);
}

/**
 * Increment a counter on the import_jobs row.
 */
async function incrementCounter(importJobId, column, amount = 1) {
  await db('import_jobs').where({ id: importJobId }).increment(column, amount);
}

// ── Worker ───────────────────────────────────────────────────────────────────

studentImportQueue.process(1, async (job) => {
  const { jobId, storageKey, centerId, callerUserId } = job.data;

  console.log(`[import-worker] Starting job ${jobId} (attempt ${job.attemptsMade + 1})`);

  // ── STEP 0: Attempt-start reset ──────────────────────────────────────────
  // Purge stale data from any previous failed attempt so counters are clean.
  await db('import_errors').where({ import_job_id: jobId }).delete();
  await db('import_jobs').where({ id: jobId }).update({
    status: 'processing',
    processed_student_rows: 0,
    processed_enrollment_rows: 0,
    students_created: 0,
    students_reused: 0,
    enrollments_created: 0,
    fees_recorded: 0,
    skip_count: 0,
    error_count: 0,
    image_queued: 0,
    image_done: 0,
    image_failed: 0,
    error_report_key: null,
    failed_reason: null,
  });

  // ── STEP 1: Read file from local disk ────────────────────────────────────
  if (!fs.existsSync(storageKey)) {
    const errorMsg = `Import file not found on disk (${storageKey}). If running API and worker in separate containers, ensure docker-compose volume is mounted .`;
    console.error(`[import-worker] ${errorMsg}`);
    await db('import_jobs').where({ id: jobId }).update({
      status: 'failed',
      failed_reason: errorMsg,
    });
    return;
  }
  const fileBuffer = fs.readFileSync(storageKey);

  // ── STEP 2: Parse spreadsheet ────────────────────────────────────────────
  const importJob = await db('import_jobs').where({ id: jobId }).first();
  const fileFormat = importJob.file_format || 'xlsx';

  let workbook;
  try {
    workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    await db('import_jobs').where({ id: jobId }).update({
      status: 'failed',
      failed_reason: 'Invalid spreadsheet format: ' + err.message,
    });
    return; 
  }

  let studentRows = [];
  let enrollmentRows = [];

  if (fileFormat === 'xlsx' && workbook.SheetNames.length >= 2) {
    // XLSX two-sheet format
    const studentsSheet = workbook.Sheets[workbook.SheetNames[0]];
    const enrollmentsSheet = workbook.Sheets[workbook.SheetNames[1]];
    studentRows = xlsx.utils.sheet_to_json(studentsSheet, { defval: '' });
    enrollmentRows = xlsx.utils.sheet_to_json(enrollmentsSheet, { defval: '' });
  } else {
    // CSV or single-sheet XLSX — flat format
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    // Deduplicate students by Student Ref, collect enrollments
    const seenRefs = new Set();
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const row = allRows[rowIndex];
      let ref = extractVal(row, ['studentref', 'student_ref']);
      if (!ref) {
        // If Student Ref column is missing or empty, assign implicit ref from phone or row number
        const phone = extractVal(row, ['phonenumber', 'phone', 'phoneno', 'phone_number', 'contact'])
          || extractVal(row, ['guardianphone', 'guardian_phone']);
        ref = phone || `_auto_row_${rowIndex + 2}`;
        row['Student Ref'] = ref; // attach to row object so Phase 1 and 2 find it
      }

      if (seenRefs.has(ref)) {
        // Subsequent occurrence — enrollment only
        enrollmentRows.push(row);
      } else {
        seenRefs.add(ref);
        studentRows.push(row);
        // Also treat as an enrollment row if class_id is present
        const classId = extractVal(row, ['classid', 'class_id']);
        if (classId) enrollmentRows.push(row);
      }
    }
  }

  await db('import_jobs').where({ id: jobId }).update({
    total_student_rows: studentRows.length,
    total_enrollment_rows: enrollmentRows.length,
  });

  // ── STEP 3: Pre-fetch static lookups ─────────────────────────────────────
  const studentRoleRow = await db('roles').where({ name: 'student' }).first();
  const guardianRoleRow = await db('roles').where({ name: 'guardian' }).first();
  if (!studentRoleRow) throw new Error("Role 'student' not found in database.");

  const classRows = await db('classes')
    .where({ center_id: centerId, is_active: true })
    .select('id', 'name', 'max_capacity', 'center_id');
  const classMap = new Map(classRows.map(c => [c.id, c]));

  // Map: studentRef → userId (built during Phase 1, used in Phase 2)
  const refToUserIdMap = new Map();

  // Job-wide student deduplication maps to track students across batches & re-uploads
  const jobMinorStudentMap = new Map(); // key: `${guardianPhone.trim()}:${fullName.trim().toLowerCase()}` -> user object
  const jobAdultStudentMap = new Map(); // key: `${phone.trim()}` -> user object

  // ── PHASE 1: Process Students ────────────────────────────────────────────
  const BATCH_SIZE = 50;

  for (let i = 0; i < studentRows.length; i += BATCH_SIZE) {
    const batch = studentRows.slice(i, i + BATCH_SIZE);

    // Collect ALL phones from this batch (student + guardian)
    const batchPhones = new Set();
    for (const row of batch) {
      const phone = extractVal(row, ['phonenumber', 'phone', 'phoneno', 'phone_number', 'contact']);
      const guardianPhone = extractVal(row, ['guardianphone', 'guardian_phone']);
      if (phone) batchPhones.add(phone.trim());
      if (guardianPhone) batchPhones.add(guardianPhone.trim());
    }

    // Batch lookup: find existing users with these phones
    const existingUsersMap = new Map();
    if (batchPhones.size > 0) {
      const existing = await db('users')
        .whereIn('phone', Array.from(batchPhones))
        .select('id', 'phone', 'full_name', 'metadata', 'is_minor');
      for (const u of existing) {
        existingUsersMap.set(u.phone, u);
      }
    }

    // Within-batch guardian dedup
    const batchGuardianMap = new Map();

    for (let j = 0; j < batch.length; j++) {
      const rawRow = batch[j];
      const rowNum = i + j + 2; // 1-indexed, row 1 is header

      const studentRef   = extractVal(rawRow, ['studentref', 'student_ref']);
      const fullName     = extractVal(rawRow, ['nameenglish', 'fullname', 'name', 'full_name']);
      const fullNameUr   = extractVal(rawRow, ['nameurdu', 'fullnameur', 'full_name_ur']);
      const fatherName   = extractVal(rawRow, ['fathername', 'father_name']);
      const phone        = extractVal(rawRow, ['phonenumber', 'phone', 'phoneno', 'phone_number', 'contact']);
      const isMinorVal   = extractVal(rawRow, ['isminor', 'is_minor', 'minor']);
      const guardianName = extractVal(rawRow, ['guardianname', 'guardian_name']);
      const guardianPhone = extractVal(rawRow, ['guardianphone', 'guardian_phone']);
      const gender       = extractVal(rawRow, ['gender', 'sex']);
      const dob          = extractVal(rawRow, ['dateofbirth', 'date_of_birth', 'dob']);
      const maritalStatus = extractVal(rawRow, ['maritalstatus', 'marital_status']);
      const qualification = extractVal(rawRow, ['qualification', 'education']);
      const occupation   = extractVal(rawRow, ['occupation', 'job']);
      const address      = extractVal(rawRow, ['address', 'location']);
      const profilePicUrl = extractVal(rawRow, ['profilepicture', 'profile_picture', 'profileimage', 'avatar', 'photo', 'image']);

      try {
        // Validate required fields
        if (!fullName) {
          await logRowError(jobId, {
            sheetName: 'Students', rowNumber: rowNum, studentRef, studentName: 'Unknown',
            phone: phone || '', errorMessage: 'Full name is required.', rowData: rawRow,
          });
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        // Flexibly parse is_minor (e.g 1, '1', true, 'true', 'yes', etc.)
        const isMinor = parseBoolean(isMinorVal);

        if (isMinor) {
          if (!guardianPhone || !guardianName) {
            await logRowError(jobId, {
              sheetName: 'Students', rowNumber: rowNum, studentRef, studentName: fullName,
              phone: guardianPhone || '', errorMessage: 'Guardian Name and Guardian Phone are required for minor students (Is Minor = true).',
              rowData: rawRow,
            });
            await incrementCounter(jobId, 'skip_count');
            continue;
          }
        } else {
          if (!phone) {
            await logRowError(jobId, {
              sheetName: 'Students', rowNumber: rowNum, studentRef, studentName: fullName,
              phone: '', errorMessage: 'Phone number is required for adult students (Is Minor = false).',
              rowData: rawRow,
            });
            await incrementCounter(jobId, 'skip_count');
            continue;
          }
        }

        // Check if student already exists
        let existingUser = null;

        if (isMinor) {
          const minorKey = `${guardianPhone.trim()}:${fullName.trim().toLowerCase()}`;
          existingUser = jobMinorStudentMap.get(minorKey);

          if (!existingUser) {
            // Find existing guardian by phone
            const guardianUser = batchGuardianMap.get(guardianPhone.trim()) 
              || existingUsersMap.get(guardianPhone.trim())
              || await db('users').where({ phone: guardianPhone.trim() }).first();

            if (guardianUser) {
              batchGuardianMap.set(guardianPhone.trim(), guardianUser);
              const foundMinor = await db('guardians')
                .join('users', 'guardians.student_user_id', 'users.id')
                .where({ 'guardians.guardian_user_id': guardianUser.id, 'users.is_minor': true })
                .andWhereRaw('LOWER(TRIM(users.full_name)) = ?', [fullName.trim().toLowerCase()])
                .select('users.id', 'users.full_name', 'users.phone')
                .first();

              if (foundMinor) {
                existingUser = foundMinor;
                jobMinorStudentMap.set(minorKey, existingUser);
              }
            }
          }
        } else {
          const adultKey = phone.trim();
          existingUser = jobAdultStudentMap.get(adultKey) || existingUsersMap.get(adultKey);

          if (!existingUser) {
            const foundAdult = await db('users')
              .where({ phone: adultKey, is_minor: false })
              .select('id', 'phone', 'full_name')
              .first();

            if (foundAdult) {
              existingUser = foundAdult;
              jobAdultStudentMap.set(adultKey, existingUser);
            }
          }
        }

        if (existingUser) {
          // Reuse existing student
          if (studentRef) refToUserIdMap.set(studentRef, existingUser.id);
          if (phone) refToUserIdMap.set(phone.trim(), existingUser.id);
          if (isMinor && guardianPhone) {
            const minorKey = `${guardianPhone.trim()}:${fullName.trim().toLowerCase()}`;
            jobMinorStudentMap.set(minorKey, existingUser);
          } else if (phone) {
            jobAdultStudentMap.set(phone.trim(), existingUser);
          }
          await incrementCounter(jobId, 'students_reused');
        } else {
          // Create new student
          const tempPass = generateTempPassword();
          const passHash = await bcrypt.hash(tempPass, 10);
          const parsedDob = parseDateMMDDYYYY(dob);

          const metadata = {
            father_name: fatherName || '',
            marital_status: maritalStatus || '',
            qualification: qualification || '',
            occupation: occupation || '',
            address: address || '',
            profile_picture: '',
          };

          const validGenders = ['male', 'female', 'other'];
          const cleanGender = validGenders.includes(String(gender).toLowerCase()) ? String(gender).toLowerCase() : null;

          const createdStudent = await db.transaction(async (trx) => {
            // Handle guardian for minor students
            let guardianUser = null;
            if (isMinor && guardianPhone) {
              const cleanGPhone = guardianPhone.trim();
              // Check within-batch dedup first
              guardianUser = batchGuardianMap.get(cleanGPhone) || existingUsersMap.get(cleanGPhone);

              if (!guardianUser) {
                // Check DB
                guardianUser = await trx('users').where({ phone: cleanGPhone }).first();
              }

              if (!guardianUser) {
                // Create guardian
                const gPass = generateTempPassword();
                const gHash = await bcrypt.hash(gPass, 10);
                const [newG] = await trx('users').insert({
                  full_name: guardianName,
                  phone: cleanGPhone,
                  whatsapp: cleanGPhone,
                  password_hash: gHash,
                  preferred_lang: 'ur',
                  is_active: true,
                  is_minor: false,
                }).returning('*');

                if (guardianRoleRow) {
                  await trx('user_roles').insert({
                    user_id: newG.id,
                    role_id: guardianRoleRow.id,
                    center_id: centerId,
                  }).onConflict(['user_id', 'role_id', 'center_id']).ignore();
                }
                guardianUser = newG;
              }

              // Track for within-batch dedup
              batchGuardianMap.set(cleanGPhone, guardianUser);
              existingUsersMap.set(cleanGPhone, guardianUser);
            }

            // Create student user (is_active = false; activated by separate credential delivery)
            const [newStudent] = await trx('users').insert({
              full_name: fullName,
              full_name_ur: fullNameUr || null,
              phone: isMinor ? null : phone.trim(),
              whatsapp: isMinor ? null : phone.trim(),
              date_of_birth: parsedDob,
              gender: cleanGender,
              preferred_lang: 'ur',
              is_active: false,
              is_minor: isMinor,
              metadata: JSON.stringify(metadata),
              password_hash: passHash,
            }).returning('*');

            // Assign student role
            await trx('user_roles').insert({
              user_id: newStudent.id,
              role_id: studentRoleRow.id,
              center_id: centerId,
            }).onConflict(['user_id', 'role_id', 'center_id']).ignore();

            // Link guardian
            if (isMinor && guardianUser) {
              await trx('guardians').insert({
                student_user_id: newStudent.id,
                guardian_user_id: guardianUser.id,
                is_primary: true,
              }).onConflict(['student_user_id', 'guardian_user_id']).ignore();
            }

            return newStudent;
          });

          // Track for Phase 2 linkage & job-wide dedup
          if (studentRef) refToUserIdMap.set(studentRef, createdStudent.id);
          if (phone) refToUserIdMap.set(phone.trim(), createdStudent.id);
          if (phone) existingUsersMap.set(phone.trim(), createdStudent);

          if (isMinor && guardianPhone) {
            const minorKey = `${guardianPhone.trim()}:${fullName.trim().toLowerCase()}`;
            jobMinorStudentMap.set(minorKey, createdStudent);
          } else if (phone) {
            jobAdultStudentMap.set(phone.trim(), createdStudent);
          }

          await incrementCounter(jobId, 'students_created');

          existingUser = createdStudent;
        }

        // Enqueue profile image job if URL is present
        // Image worker handles dedup via metadata.profile_picture skip check
        if (profilePicUrl && existingUser) {
          try {
            new URL(profilePicUrl); // quick URL validation
            await profileImageQueue.add({
              userId: existingUser.id,
              imageUrl: profilePicUrl,
              importJobId: jobId,
            });
            await incrementCounter(jobId, 'image_queued');
          } catch {
            // Invalid URL format — log as warning, don't fail the row
            await logRowError(jobId, {
              sheetName: 'Image', rowNumber: rowNum, studentRef, studentName: fullName,
              phone: phone || guardianPhone || '',
              errorMessage: `Invalid profile image URL: ${profilePicUrl}`,
              rowData: null,
            });
          }
        }
      } catch (err) {
        if (isFatalError(err)) throw err;
        await logRowError(jobId, {
          sheetName: 'Students', rowNumber: rowNum, studentRef, studentName: fullName || 'Unknown',
          phone: phone || '', errorMessage: err.message || 'Unexpected error during student creation.',
          rowData: rawRow,
        });
        await incrementCounter(jobId, 'skip_count');
      }
    }

    // Update progress
    await db('import_jobs').where({ id: jobId }).update({
      processed_student_rows: Math.min(i + BATCH_SIZE, studentRows.length),
    });
  }

  // ── PHASE 2: Process Enrollments ─────────────────────────────────────────

  for (let i = 0; i < enrollmentRows.length; i += BATCH_SIZE) {
    const batch = enrollmentRows.slice(i, i + BATCH_SIZE);

    // Resolve Student Refs → user IDs and collect enrollment pairs for batch lookup
    const batchPairs = [];
    const resolvedBatch = [];

    for (const row of batch) {
      let studentRef = extractVal(row, ['studentref', 'student_ref']);
      if (!studentRef) {
        studentRef = extractVal(row, ['phonenumber', 'phone', 'phoneno', 'phone_number', 'contact'])
          || extractVal(row, ['guardianphone', 'guardian_phone']);
      }
      const classId    = extractVal(row, ['classid', 'class_id']);

      let userId = null;
      if (studentRef) {
        // Check Phase 1 map first
        userId = refToUserIdMap.get(studentRef) || refToUserIdMap.get(studentRef.trim());
        // If not found, try as a phone number lookup
        if (!userId && /^\d{10,}$/.test(studentRef.trim())) {
          const user = await db('users').where({ phone: studentRef.trim() }).first('id');
          if (user) userId = user.id;
        }
      }
      // Fallback: check job-wide dedup maps if studentRef was not directly mapped
      if (!userId) {
        const studentName = extractVal(row, ['nameenglish', 'fullname', 'name', 'full_name', 'studentname', 'student_name']);
        const gPhone = extractVal(row, ['guardianphone', 'guardian_phone']);
        const sPhone = extractVal(row, ['phonenumber', 'phone', 'phoneno', 'phone_number', 'contact']);
        if (gPhone && studentName) {
          const minorUser = jobMinorStudentMap.get(`${gPhone.trim()}:${studentName.trim().toLowerCase()}`);
          if (minorUser) userId = minorUser.id;
        }
        if (!userId && sPhone) {
          const adultUser = jobAdultStudentMap.get(sPhone.trim());
          if (adultUser) userId = adultUser.id;
        }
      }

      resolvedBatch.push({ row, studentRef, classId, userId });
      if (userId && classId) {
        batchPairs.push({ student_user_id: userId, class_id: classId });
      }
    }

    // Batch lookup existing enrollments
    const existingEnrollments = new Set();
    if (batchPairs.length > 0) {
      const existing = await db('enrollments')
        .where(function () {
          for (const pair of batchPairs) {
            this.orWhere({ student_user_id: pair.student_user_id, class_id: pair.class_id });
          }
        })
        .select('student_user_id', 'class_id');
      for (const e of existing) {
        existingEnrollments.add(`${e.student_user_id}:${e.class_id}`);
      }
    }

    for (let j = 0; j < resolvedBatch.length; j++) {
      const { row: rawRow, studentRef, classId, userId } = resolvedBatch[j];
      const rowNum = i + j + 2;
      const enrolledOn   = extractVal(rawRow, ['enrolledon', 'enrolled_on']);
      const priorLevel   = extractVal(rawRow, ['priorlevel', 'prior_level']);
      const notesUr      = extractVal(rawRow, ['notesurdu', 'notes_ur', 'notes']);
      const amountPaid   = extractVal(rawRow, ['amountpaid', 'amount_paid']);
      const paymentMethod = extractVal(rawRow, ['paymentmethod', 'payment_method']);

      try {
        if (!userId) {
          await logRowError(jobId, {
            sheetName: 'Enrollments', rowNumber: rowNum, studentRef,
            errorMessage: `Could not resolve Student Ref "${studentRef}" to a user. Ensure it matches a ref in the Students sheet or an existing student's phone number.`,
            rowData: rawRow,
          });
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        if (!classId) {
          await logRowError(jobId, {
            sheetName: 'Enrollments', rowNumber: rowNum, studentRef,
            errorMessage: 'Class ID is required.', rowData: rawRow,
          });
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        if (!enrolledOn) {
          await logRowError(jobId, {
            sheetName: 'Enrollments', rowNumber: rowNum, studentRef,
            errorMessage: 'Enrolled On date is required (MM-DD-YYYY).', rowData: rawRow,
          });
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        const parsedEnrolledOn = parseDateMMDDYYYY(enrolledOn);
        if (!parsedEnrolledOn) {
          await logRowError(jobId, {
            sheetName: 'Enrollments', rowNumber: rowNum, studentRef,
            errorMessage: `Invalid date format: "${enrolledOn}". Expected MM-DD-YYYY.`, rowData: rawRow,
          });
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        // Validate class exists in this center
        const classObj = classMap.get(classId);
        if (!classObj) {
          await logRowError(jobId, {
            sheetName: 'Enrollments', rowNumber: rowNum, studentRef,
            errorMessage: `Class ID "${classId}" not found or not active in this center.`, rowData: rawRow,
          });
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        // Check if already enrolled (from batch lookup)
        if (existingEnrollments.has(`${userId}:${classId}`)) {
          await incrementCounter(jobId, 'skip_count');
          continue;
        }

        // Atomic enrollment with capacity check
        await db.transaction(async (trx) => {
          // Lock class row and check capacity
          if (classObj.max_capacity) {
            const [{ count }] = await trx('enrollments')
              .where({ class_id: classId, status: 'active', is_active: true })
              .count('id as count');

            if (parseInt(count) >= classObj.max_capacity) {
              throw new Error(`Class "${classObj.name}" (${classId}) has reached maximum capacity (${classObj.max_capacity}).`);
            }
          }

          // FOR UPDATE lock on the class row for atomicity
          await trx('classes').where({ id: classId }).forUpdate().first();

          // Insert enrollment (ON CONFLICT skip for idempotency)
          const result = await trx('enrollments').insert({
            student_user_id: userId,
            class_id: classId,
            center_id: centerId,
            status: 'active',
            enrolled_on: parsedEnrolledOn,
            prior_level: priorLevel || null,
            notes_ur: notesUr || null,
            is_active: true,
          }).onConflict(['class_id', 'student_user_id']).ignore().returning('id');

          const wasNewlyCreated = result && result.length > 0;

          // Insert fee payment only if enrollment was newly created
          if (wasNewlyCreated && amountPaid) {
            const amount = parseFloat(amountPaid);
            if (!isNaN(amount) && amount > 0) {
              await trx('fee_payments').insert({
                enrollment_id: result[0].id,
                amount_paid: amount,
                currency: 'PKR',
                payment_method: paymentMethod || 'cash',
                received_by_user_id: callerUserId,
                center_id: centerId,
                payment_date: parsedEnrolledOn,
              });
              await incrementCounter(jobId, 'fees_recorded');
            }
          }

          if (wasNewlyCreated) {
            await incrementCounter(jobId, 'enrollments_created');
          } else {
            await incrementCounter(jobId, 'skip_count');
          }
        });

        // Track in set to prevent duplicate processing within this batch
        existingEnrollments.add(`${userId}:${classId}`);
      } catch (err) {
        if (isFatalError(err)) throw err;
        await logRowError(jobId, {
          sheetName: 'Enrollments', rowNumber: rowNum, studentRef,
          errorMessage: err.message || 'Unexpected error during enrollment creation.',
          rowData: rawRow,
        });
        await incrementCounter(jobId, 'skip_count');
      }
    }

    // Update progress
    await db('import_jobs').where({ id: jobId }).update({
      processed_enrollment_rows: Math.min(i + BATCH_SIZE, enrollmentRows.length),
    });
  }

  // ── STEP 5: Generate error report if errors exist ────────────────────────
  const finalJob = await db('import_jobs').where({ id: jobId }).first();

  if (finalJob.error_count > 0) {
    try {
      const errors = await db('import_errors')
        .where({ import_job_id: jobId })
        .orderBy('row_number', 'asc');

      const errorRows = errors.map(e => {
          let rowData = e.row_data;
          if (typeof rowData === 'string') {
            try { rowData = JSON.parse(rowData); } catch { rowData = {}; }
          }
          rowData = rowData && typeof rowData === 'object' ? rowData : {};

          // Preserve the failed row context even for image or job-level errors
          // that do not have spreadsheet cell data.
          if (Object.keys(rowData).length === 0) {
            rowData = {
              Sheet: e.sheet_name || '',
              Row: e.row_number || '',
              'Student Ref': e.student_ref || '',
              'Student Name': e.student_name || '',
              Phone: e.phone || '',
            };
          }

          return { ...rowData, Error: e.error_message };
        });

      if (errorRows.length > 0) {
        const ws = xlsx.utils.json_to_sheet(errorRows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Failed Rows');

        const reportFormat = fileFormat === 'csv' ? 'csv' : 'xlsx';
        let reportBuffer;
        if (reportFormat === 'csv') {
          const csvContent = xlsx.utils.sheet_to_csv(ws);
          reportBuffer = Buffer.from(csvContent, 'utf-8');
        } else {
          reportBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        }

        const TEMP_DIR = process.env.IMPORT_TEMP_DIR || path.join(process.cwd(), 'tmp', 'imports');
        fs.mkdirSync(TEMP_DIR, { recursive: true });
        const reportPath = path.join(TEMP_DIR, `${jobId}_errors.${reportFormat}`);
        fs.writeFileSync(reportPath, reportBuffer);
        await db('import_jobs').where({ id: jobId }).update({ error_report_key: reportPath });
      }
    } catch (reportErr) {
      console.warn(`[import-worker] Failed to generate error report for job ${jobId}:`, reportErr.message);
    }
  }

  // ── STEP 6: Clean up temp import file (keep error report for download) ──
  try {
    if (fs.existsSync(storageKey)) fs.unlinkSync(storageKey);
  } catch (cleanupErr) {
    console.warn(`[import-worker] Failed to delete temp file ${storageKey}:`, cleanupErr.message);
  }

  // ── STEP 7: Mark job completed ───────────────────────────────────────────
  await db('import_jobs').where({ id: jobId }).update({ status: 'completed' });
  console.log(`[import-worker] Job ${jobId} completed.`);
});

// ── Event handlers ─────────────────────────────────────────────────────────

studentImportQueue.on('completed', (job) => {
  console.log(`[import-worker] Job ${job.id} completed successfully.`);
});

studentImportQueue.on('failed', async (job, err) => {
  console.error(`[import-worker] Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
  try {
    await db('import_jobs').where({ id: job.data.jobId }).update({
      status: 'failed',
      failed_reason: err.message,
    });
  } catch (updateErr) {
    console.error(`[import-worker] Could not update job status:`, updateErr.message);
  }
});

console.log('[import-worker] Listening on queue: student-import');
