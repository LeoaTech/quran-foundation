const xlsx = require('xlsx');
const db = require('../db/knex');

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

module.exports = {
  exportStudentsData
};
