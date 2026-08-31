const xlsx = require('xlsx');
const db = require('../db/knex');
const { AppError } = require('../utils/errors');
const bunnyService = require('./bunny.service');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Export student profiles scoped by Center ID (or all centers for super_admin).
 * Returns { buffer, filename, contentType }
 */
async function exportStudentsData({ user: caller, centerId, format = 'xlsx' }) {
  // Center Managers can only export students in their own center
  let targetCenterId = centerId;
  if (!caller.roles.includes('super_admin') && !caller.roles.includes('finance_manager')) {
    targetCenterId = caller.center_id;
  }

  // Query all student user accounts matching target center
  const query = db('users as u')
    .join('user_roles as ur', 'ur.user_id', 'u.id')
    .join('roles as r', 'r.id', 'ur.role_id')
    .leftJoin('centers as c', 'c.id', 'ur.center_id')
    .where('r.name', 'student')
    .select(
      'u.id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
      'u.email',
      'u.gender',
      'u.date_of_birth',
      'u.preferred_lang',
      'u.is_active',
      'u.is_minor',
      'u.metadata',
      'u.created_at',
      'c.name as center_name',
      'ur.center_id',
      db.raw(`(
        SELECT string_agg(co.name, ', ') 
        FROM enrollments e 
        JOIN classes cl ON e.class_id = cl.id 
        JOIN courses co ON cl.course_id = co.id 
        WHERE e.student_user_id = u.id AND e.status = 'active'
      ) as enrolled_courses`),
      db.raw(`(
        SELECT gu.phone 
        FROM guardians g 
        JOIN users gu ON g.guardian_user_id = gu.id 
        WHERE g.student_user_id = u.id AND g.is_primary = true 
        LIMIT 1
      ) as primary_guardian_phone`),
      db.raw(`(
        SELECT gu.full_name 
        FROM guardians g 
        JOIN users gu ON g.guardian_user_id = gu.id 
        WHERE g.student_user_id = u.id AND g.is_primary = true 
        LIMIT 1
      ) as primary_guardian_name`)
    )
    .orderBy('u.full_name', 'asc');

  if (targetCenterId && targetCenterId !== 'all') {
    query.where('ur.center_id', targetCenterId);
  }

  const rows = await query;

  // Map each student row into structured fields
  const exportedRows = rows.map((r) => {
    let metadata = r.metadata;
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    }
    metadata = metadata || {};

    // Phone logic: if student is minor or has no phone, show guardian phone number
    const effectivePhone = r.phone || r.primary_guardian_phone || '';

    let dob = '';
    if (r.date_of_birth) {
      try {
        dob = new Date(r.date_of_birth).toISOString().split('T')[0];
      } catch (e) {
        dob = String(r.date_of_birth);
      }
    }

    return {
      'Student ID': r.id || '',
      'Name (English)': r.full_name || '',
      'Name (Urdu)': r.full_name_ur || '',
      'Father Name': metadata.father_name || '',
      'Phone Number': effectivePhone,
      'Is Minor': r.is_minor ? 'Yes' : 'No',
      'Guardian Name': r.primary_guardian_name || '',
      'Guardian Phone': r.primary_guardian_phone || '',
      'Gender': r.gender || '',
      'Date of Birth': dob,
      'Marital Status': metadata.marital_status || '',
      'Qualification': metadata.qualification || '',
      'Occupation': metadata.occupation || '',
      'Profile Picture': metadata.profile_picture || '',
      'Center Name': r.center_name || '',
      'Enrolled Courses': r.enrolled_courses || '',
      'Status': r.is_active ? 'Active' : 'Inactive',
    };
  });

  const worksheet = xlsx.utils.json_to_sheet(exportedRows);

  const headers = exportedRows[0] ? Object.keys(exportedRows[0]) : [];
  const colWidths = headers.map((header) => {
    let maxLen = header.length;
    exportedRows.forEach((row) => {
      const valStr = String(row[header] || '');
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

  const fileFormat = String(format).toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `students_export_${timestamp}.${fileFormat}`;

  if (fileFormat === 'csv') {
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    return {
      buffer: Buffer.from(csvContent, 'utf-8'),
      filename,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    buffer,
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}


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
 * Generate a sample import spreadsheet template (Excel or CSV).
 */
async function getImportTemplate({ format = 'csv' } = {}) {
  const sampleRows = [
    {
      'Name (English)': 'Ahmad Raza',
      'Name (Urdu)': 'احمد رضا',
      'Father Name': 'Muhammad Ali',
      'Phone Number': '03001234567',
      'Is Minor': 'No',
      'Guardian Name': '',
      'Guardian Phone': '',
      'Gender': 'male',
      'Date of Birth': '1998-05-15',
      'Marital Status': 'Single',
      'Qualification': 'Bachelors',
      'Occupation': 'Student',
      'Address': 'House 123, Block A',
    },
    {
      'Name (English)': 'Fatima Ali',
      'Name (Urdu)': 'فاطمہ علی',
      'Father Name': 'Ali Hassan',
      'Phone Number': '',
      'Is Minor': 'Yes',
      'Guardian Name': 'Ali Hassan',
      'Guardian Phone': '03009876543',
      'Gender': 'female',
      'Date of Birth': '2015-08-20',
      'Marital Status': 'Single',
      'Qualification': 'Primary',
      'Occupation': 'Student',
      'Address': 'House 456, Block B',
    },
  ];

  const worksheet = xlsx.utils.json_to_sheet(sampleRows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Import Template');

  const fileFormat = String(format).toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const filename = `sample_student_import_template.${fileFormat}`;

  if (fileFormat === 'csv') {
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    return {
      buffer: Buffer.from(csvContent, 'utf-8'),
      filename,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    buffer,
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

/**
 * Import students from CSV / XLSX file buffer with field validation,
 * phone uniqueness checks, guardian linkage, and Bunny.net profile image processing.
 */
async function importStudentsData({ user: caller, centerId, fileBuffer }) {
  if (!fileBuffer || !fileBuffer.length) {
    throw new AppError('VALIDATION_ERROR', 'No file uploaded or file is empty.', 'فائل لاپتا یا خالی ہے۔', 400);
  }

  let workbook;
  try {
    workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', 'Invalid Excel/CSV file format.', 'فائل کی ساخت غیر درست ہے۔', 400);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new AppError('VALIDATION_ERROR', 'File contains no sheets.', 'فائل میں کوئی شیٹ نہیں ہے۔', 400);
  }

  const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rawRows.length) {
    throw new AppError('VALIDATION_ERROR', 'Spreadsheet is empty.', 'اسپریڈ شیٹ میں کوئی ڈیٹا نہیں ہے۔', 400);
  }

  // Pre-fetch roles
  const studentRoleRow = await db('roles').where({ name: 'student' }).first();
  const guardianRoleRow = await db('roles').where({ name: 'guardian' }).first();
  if (!studentRoleRow) throw new Error("Role 'student' not found in database.");

  // Pre-fetch centers map
  const centers = await db('centers').select('id', 'name');
  const validCenterIds = new Set(centers.map(c => String(c.id)));

  // Performance Optimization: Pre-fetch all registered non-null phone numbers into a Set for fast O(1) checks
  const dbPhoneRows = await db('users').whereNotNull('phone').select('phone');
  const existingPhonesSet = new Set(dbPhoneRows.map(r => r.phone.trim()));
  const seenPhonesInFile = new Set();
  const createdGuardiansMap = new Map();

  let successCount = 0;
  let skippedCount = 0;
  const errors = [];
  const importedStudents = [];

  for (let index = 0; index < rawRows.length; index++) {
    const rawRow = rawRows[index];
    const rowNum = index + 2; // 1-indexed header is row 1

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
    const profilePicRaw = extractVal(rawRow, ['profilepicture', 'profile_picture', 'profileimage', 'avatar', 'photo', 'image']);
    const rowCenterId  = extractVal(rawRow, ['centerid', 'center_id']);

    if (!fullName) {
      errors.push({ row: rowNum, name: 'Unknown', phone: phone || '', error: 'Full name is required.' });
      skippedCount++;
      continue;
    }

    // Determine target center ID
    let targetCenterId = caller.center_id;
    if (caller.roles.includes('super_admin') || caller.roles.includes('finance_manager')) {
      targetCenterId = rowCenterId || centerId;
    }

    if (!targetCenterId || !validCenterIds.has(String(targetCenterId))) {
      errors.push({ row: rowNum, name: fullName, phone: phone || '', error: 'Target center ID is missing or invalid.' });
      skippedCount++;
      continue;
    }

    const isMinor = String(isMinorVal).toLowerCase() === 'yes' || String(isMinorVal).toLowerCase() === 'true' || String(isMinorVal) === '1';

    if (isMinor) {
      if (!guardianPhone || !guardianName) {
        errors.push({
          row: rowNum,
          name: fullName,
          phone: guardianPhone || '',
          error: 'Both Guardian Phone and Guardian Name are required for minor students.',
        });
        skippedCount++;
        continue;
      }
    } else {
      if (!phone) {
        errors.push({ row: rowNum, name: fullName, phone: '', error: 'Phone number is required for adult students.' });
        skippedCount++;
        continue;
      }
      if (existingPhonesSet.has(phone) || seenPhonesInFile.has(phone)) {
        errors.push({ row: rowNum, name: fullName, phone, error: `Account with phone number ${phone} already exists.` });
        skippedCount++;
        continue;
      }
      seenPhonesInFile.add(phone);
    }

    try {
      const tempPass = generateTempPassword();
      const passHash = await bcrypt.hash(tempPass, 10);

      // Metadata object construction (default to empty string if unprovided)
      const metadata = {
        father_name: fatherName || '',
        marital_status: maritalStatus || '',
        qualification: qualification || '',
        occupation: occupation || '',
        address: address || '',
        profile_picture: '',
      };

      // Profile image validation and Bunny.net upload if needed
      if (profilePicRaw) {
        if (profilePicRaw.startsWith('http://') || profilePicRaw.startsWith('https://')) {
          metadata.profile_picture = profilePicRaw;
        } else if (profilePicRaw.startsWith('data:image/')) {
          const match = profilePicRaw.match(/^data:image\/(png|jpg|jpeg|webp|gif);base64,/i);
          if (match) {
            try {
              const base64Data = profilePicRaw.replace(/^data:image\/\w+;base64,/, '');
              const imgBuffer = Buffer.from(base64Data, 'base64');
              const uploadedUrl = await bunnyService.uploadImage(imgBuffer, 'student_profiles');
              if (uploadedUrl) {
                metadata.profile_picture = uploadedUrl;
              }
            } catch (imgErr) {
              console.warn(`[Import] Bunny.net upload failed for row ${rowNum}:`, imgErr.message);
            }
          }
        }
      }

      const createdStudent = await db.transaction(async (trx) => {
        let guardianUser = null;
        if (isMinor && guardianPhone) {
          if (createdGuardiansMap.has(guardianPhone)) {
            guardianUser = createdGuardiansMap.get(guardianPhone);
          } else {
            guardianUser = await trx('users').where({ phone: guardianPhone }).first();
            if (!guardianUser) {
              const gPass = generateTempPassword();
              const gHash = await bcrypt.hash(gPass, 10);

              const [newG] = await trx('users').insert({
                full_name: guardianName,
                phone: guardianPhone,
                whatsapp: guardianPhone,
                password_hash: gHash,
                preferred_lang: 'ur',
                is_active: true,
                is_minor: false,
              }).returning('*');

              if (guardianRoleRow) {
                await trx('user_roles').insert({
                  user_id: newG.id,
                  role_id: guardianRoleRow.id,
                  center_id: targetCenterId,
                }).onConflict(['user_id', 'role_id', 'center_id']).ignore();
              }
              guardianUser = newG;
            }
            createdGuardiansMap.set(guardianPhone, guardianUser);
            existingPhonesSet.add(guardianPhone);
          }
        }

        const validGenders = ['male', 'female', 'other'];
        const cleanGender = validGenders.includes(String(gender).toLowerCase()) ? String(gender).toLowerCase() : null;

        const [newStudent] = await trx('users').insert({
          full_name: fullName,
          full_name_ur: fullNameUr || null,
          phone: isMinor ? null : phone,
          whatsapp: isMinor ? null : phone,
          date_of_birth: dob || null,
          gender: cleanGender,
          preferred_lang: 'ur',
          is_active: true,
          is_minor: isMinor,
          metadata: JSON.stringify(metadata),
          password_hash: passHash,
        }).returning('*');

        await trx('user_roles').insert({
          user_id: newStudent.id,
          role_id: studentRoleRow.id,
          center_id: targetCenterId,
        });

        if (isMinor && guardianUser) {
          await trx('guardians').insert({
            student_user_id: newStudent.id,
            guardian_user_id: guardianUser.id,
            is_primary: true,
          }).onConflict(['student_user_id', 'guardian_user_id']).ignore();
        }

        return newStudent;
      });

      if (!isMinor && phone) {
        existingPhonesSet.add(phone);
      }

      successCount++;
      importedStudents.push({
        id: createdStudent.id,
        full_name: createdStudent.full_name,
        phone: createdStudent.phone || guardianPhone,
        is_minor: createdStudent.is_minor,
        temp_password: tempPass,
      });
    } catch (err) {
      errors.push({
        row: rowNum,
        name: fullName,
        phone: isMinor ? guardianPhone : (phone || ''),
        error: err.message || 'Database error during insertion.',
      });
      skippedCount++;
    }
  }

  return {
    total: rawRows.length,
    successCount,
    skippedCount,
    errorCount: errors.length,
    errors,
    importedStudents,
  };
}

module.exports = {
  exportStudentsData,
  importStudentsData,
  getImportTemplate,
};
