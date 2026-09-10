const xlsx = require('xlsx');
const db = require('../db/knex');
const { AppError } = require('../utils/errors');
const fs = require('fs');
const path = require('path');
const studentImportQueue = require('../jobs/studentImport');

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


/**
 * Generate a sample import spreadsheet template.
 * XLSX: Two sheets (Students + Enrollments).
 * CSV: Flat single-sheet with one enrollment per row, student fields repeated.
 */
async function getImportTemplate({ format = 'xlsx' } = {}) {
  const fileFormat = String(format).toLowerCase() === 'csv' ? 'csv' : 'xlsx';

  if (fileFormat === 'xlsx') {
    // ── XLSX: Two-sheet template ──────────────────────────────────────────
    const studentSample = [
      {
        'Student Ref': 'S1', 'Name (English)': 'Ahmad Raza', 'Name (Urdu)': 'احمد رضا',
        'Father Name': 'Muhammad Ali', 'Phone Number': '03001234567', 'Is Minor': 'false',
        'Guardian Name': '', 'Guardian Phone': '', 'Gender': 'male',
        'Date of Birth': '05-15-1998', 'Marital Status': 'Single',
        'Qualification': 'Bachelors', 'Occupation': 'Student',
        'Address': 'House 123, Block A', 'Profile Picture': '',
      },
      {
        'Student Ref': 'S2', 'Name (English)': 'Fatima Ali', 'Name (Urdu)': 'فاطمہ علی',
        'Father Name': 'Ali Hassan', 'Phone Number': '', 'Is Minor': 'true',
        'Guardian Name': 'Ali Hassan', 'Guardian Phone': '03009876543', 'Gender': 'female',
        'Date of Birth': '08-20-2015', 'Marital Status': '',
        'Qualification': 'Primary', 'Occupation': 'Student',
        'Address': 'House 456, Block B', 'Profile Picture': 'https://drive.google.com/file/d/abc123/view',
      },
    ];

    const enrollmentSample = [
      {
        'Student Ref': 'S1', 'Class ID': '<paste-class-uuid-here>',
        'Enrolled On': '01-15-2024', 'Prior Level': '',
        'Notes (Urdu)': '', 'Amount Paid': '5000', 'Payment Method': 'cash',
      },
      {
        'Student Ref': 'S2', 'Class ID': '<paste-class-uuid-here>',
        'Enrolled On': '01-15-2024', 'Prior Level': 'Beginner',
        'Notes (Urdu)': '', 'Amount Paid': '3000', 'Payment Method': 'cash',
      },
      {
        'Student Ref': 'S2', 'Class ID': '<paste-second-class-uuid>',
        'Enrolled On': '01-15-2024', 'Prior Level': '',
        'Notes (Urdu)': '', 'Amount Paid': '2000', 'Payment Method': 'cash',
      },
    ];

    const ws1 = xlsx.utils.json_to_sheet(studentSample);
    const ws2 = xlsx.utils.json_to_sheet(enrollmentSample);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, ws1, 'Students');
    xlsx.utils.book_append_sheet(workbook, ws2, 'Enrollments');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer,
      filename: 'sample_student_import_template.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // ── CSV: Flat single-sheet template ──────────────────────────────────────
  const csvSample = [
    {
      'Student Ref': 'S1', 'Name (English)': 'Ahmad Raza', 'Name (Urdu)': 'احمد رضا',
      'Father Name': 'Muhammad Ali', 'Phone Number': '03001234567', 'Is Minor': 'false',
      'Guardian Name': '', 'Guardian Phone': '', 'Gender': 'male',
      'Date of Birth': '05-15-1998', 'Marital Status': 'Single',
      'Qualification': 'Bachelors', 'Occupation': 'Student',
      'Address': 'House 123, Block A', 'Profile Picture': '',
      'Class ID': '<paste-class-uuid-here>', 'Enrolled On': '01-15-2024',
      'Prior Level': '', 'Notes (Urdu)': '', 'Amount Paid': '5000', 'Payment Method': 'cash',
    },
    {
      'Student Ref': 'S2', 'Name (English)': 'Fatima Ali', 'Name (Urdu)': 'فاطمہ علی',
      'Father Name': 'Ali Hassan', 'Phone Number': '', 'Is Minor': 'true',
      'Guardian Name': 'Ali Hassan', 'Guardian Phone': '03009876543', 'Gender': 'female',
      'Date of Birth': '08-20-2015', 'Marital Status': '',
      'Qualification': 'Primary', 'Occupation': 'Student',
      'Address': 'House 456, Block B', 'Profile Picture': '',
      'Class ID': '<paste-class-uuid-here>', 'Enrolled On': '01-15-2024',
      'Prior Level': 'Beginner', 'Notes (Urdu)': '', 'Amount Paid': '3000', 'Payment Method': 'cash',
    },
    {
      'Student Ref': 'S2', 'Name (English)': 'Fatima Ali', 'Name (Urdu)': 'فاطمہ علی',
      'Father Name': 'Ali Hassan', 'Phone Number': '', 'Is Minor': 'true',
      'Guardian Name': 'Ali Hassan', 'Guardian Phone': '03009876543', 'Gender': 'female',
      'Date of Birth': '08-20-2015', 'Marital Status': '',
      'Qualification': 'Primary', 'Occupation': 'Student',
      'Address': 'House 456, Block B', 'Profile Picture': '',
      'Class ID': '<paste-second-class-uuid>', 'Enrolled On': '01-15-2024',
      'Prior Level': '', 'Notes (Urdu)': '', 'Amount Paid': '2000', 'Payment Method': 'cash',
    },
  ];

  const ws = xlsx.utils.json_to_sheet(csvSample);
  const csvContent = xlsx.utils.sheet_to_csv(ws);
  return {
    buffer: Buffer.from(csvContent, 'utf-8'),
    filename: 'sample_student_import_template.csv',
    contentType: 'text/csv; charset=utf-8',
  };
}

/**
 * Async import: validate file, save to local temp storage,
 * create import_jobs row, enqueue to Bull queue.
 * Returns { jobId, status: 'queued' } immediately.
 */
async function importStudentsData({ user: caller, centerId, fileBuffer, fileName }) {
  if (!fileBuffer || !fileBuffer.length) {
    throw new AppError('VALIDATION_ERROR', 'No file uploaded or file is empty.', 'فائل لاپتا یا خالی ہے۔', 400);
  }

  // Quick format validation (can we parse it at all?)
  try {
    xlsx.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', 'Invalid Excel/CSV file format.', 'فائل کی ساخت غیر درست ہے۔', 400);
  }

  // Determine target center
  let targetCenterId = caller.center_id;
  if (caller.roles.includes('super_admin') || caller.roles.includes('finance_manager')) {
    targetCenterId = centerId || caller.center_id;
  }

  if (!targetCenterId) {
    throw new AppError('VALIDATION_ERROR', 'Target center ID is required.', 'مرکز کی شناخت ضروری ہے۔', 400);
  }

  // Detect file format
  const ext = (fileName || '').toLowerCase();
  const fileFormat = ext.endsWith('.csv') ? 'csv' : 'xlsx';

  // Save file to local temp directory (shared with workers)
  const TEMP_DIR = process.env.IMPORT_TEMP_DIR || path.join(process.cwd(), 'tmp', 'imports');
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const localFileName = `${crypto.randomUUID()}.${fileFormat}`;
  const localPath = path.join(TEMP_DIR, localFileName);
  fs.writeFileSync(localPath, fileBuffer);

  // Create import job record
  const [importJob] = await db('import_jobs').insert({
    center_id: targetCenterId,
    created_by: caller.id,
    status: 'queued',
    storage_key: localPath,
    file_name: fileName || `import.${fileFormat}`,
    file_format: fileFormat,
  }).returning('*');

  // Enqueue to Bull queue — lightweight payload, no file data
  await studentImportQueue.add({
    jobId: importJob.id,
    storageKey: localPath,
    centerId: targetCenterId,
    callerUserId: caller.id,
    callerRoles: caller.roles,
    callerCenterId: caller.center_id,
  });

  return {
    jobId: importJob.id,
    status: 'queued',
    message: 'File uploaded successfully. Import is being processed in the background.',
  };
}

/**
 * Get the current status and progress of an import job.
 * Includes paginated error list.
 */
async function getImportJobStatus({ jobId, page = 1, limit = 50 }) {
  const job = await db('import_jobs').where({ id: jobId }).first();
  if (!job) {
    throw new AppError('NOT_FOUND', 'Import job not found.', 'درآمد کا کام نہیں ملا۔', 404);
  }

  // Calculate progress percentages
  const studentProgress = job.total_student_rows > 0
    ? Math.round((job.processed_student_rows / job.total_student_rows) * 100)
    : 0;
  const enrollmentProgress = job.total_enrollment_rows > 0
    ? Math.round((job.processed_enrollment_rows / job.total_enrollment_rows) * 100)
    : 0;

  // Paginated errors
  const offset = (page - 1) * limit;
  const errors = await db('import_errors')
    .where({ import_job_id: jobId })
    .orderBy('row_number', 'asc')
    .limit(limit)
    .offset(offset);

  const [{ count: totalErrors }] = await db('import_errors')
    .where({ import_job_id: jobId })
    .count('id as count');

  // Error report is stored locally and served via the download endpoint
  const errorReportUrl = job.error_report_key ? `/api/users/import/${jobId}/errors/download` : null;

  return {
    jobId: job.id,
    status: job.status,
    fileName: job.file_name,
    failedReason: job.failed_reason,
    progress: {
      students: {
        processed: job.processed_student_rows,
        total: job.total_student_rows,
        percentage: studentProgress,
      },
      enrollments: {
        processed: job.processed_enrollment_rows,
        total: job.total_enrollment_rows,
        percentage: enrollmentProgress,
      },
    },
    counters: {
      studentsCreated: job.students_created,
      studentsReused: job.students_reused,
      enrollmentsCreated: job.enrollments_created,
      feesRecorded: job.fees_recorded,
      skipped: job.skip_count,
      errors: job.error_count,
    },
    imageProgress: {
      queued: job.image_queued,
      done: job.image_done,
      failed: job.image_failed,
    },
    errorReportUrl,
    errors: errors.map(e => ({
      id: e.id,
      sheet: e.sheet_name,
      row: e.row_number,
      studentRef: e.student_ref,
      studentName: e.student_name,
      phone: e.phone,
      error: e.error_message,
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalErrors: parseInt(totalErrors),
      hasMore: offset + errors.length < parseInt(totalErrors),
    },
  };
}

async function generateImportErrorReport(jobId) {
  const job = await db('import_jobs').where({ id: jobId }).first();
  if (!job) {
    throw new AppError('NOT_FOUND', 'Import job not found.', 'درآمد کا کام نہیں ملا۔', 404);
  }

  const errors = await db('import_errors')
    .where({ import_job_id: jobId })
    .orderBy('row_number', 'asc');

  if (errors.length === 0) {
    throw new AppError('NOT_FOUND', 'No import errors found for this job.', 'اس درآمدی کام کے لیے کوئی خرابی نہیں ملی۔', 404);
  }

  const rows = errors.map((error) => {
    let rowData = error.row_data;
    if (typeof rowData === 'string') {
      try { rowData = JSON.parse(rowData); } catch { rowData = {}; }
    }
    if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData) || Object.keys(rowData).length === 0) {
      rowData = {
        Sheet: error.sheet_name || '',
        Row: error.row_number || '',
        'Student Ref': error.student_ref || '',
        'Student Name': error.student_name || '',
        Phone: error.phone || '',
      };
    }
    return { ...rowData, Error: error.error_message };
  });

  const worksheet = xlsx.utils.json_to_sheet(rows);
  const format = job.file_format === 'csv' ? 'csv' : 'xlsx';
  if (format === 'csv') {
    return {
      buffer: Buffer.from(xlsx.utils.sheet_to_csv(worksheet), 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
      filename: `import_errors_${jobId}.csv`,
    };
  }

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Failed Rows');
  return {
    buffer: xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `import_errors_${jobId}.xlsx`,
  };
}

module.exports = {
  exportStudentsData,
  importStudentsData,
  getImportTemplate,
  getImportJobStatus,
  generateImportErrorReport,
};
