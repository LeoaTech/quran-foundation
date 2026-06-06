const db = require('../db/knex');

// ── Enrollments ───────────────────────────────────────────────────────────────

function getEnrollmentById(enrollmentId) {
  return db('enrollments').where({ id: enrollmentId }).first();
}

// Used for duplicate-enrollment guard: returns any active enrollment row for
// this student+class combination, regardless of is_active.
function getActiveEnrollmentForStudent(classId, studentUserId) {
  return db('enrollments')
    .where({ class_id: classId, student_user_id: studentUserId, status: 'active' })
    .first();
}

// Returns the count of active enrollments — used for capacity check.
async function countActiveEnrollments(classId) {
  const result = await db('enrollments')
    .where({ class_id: classId, status: 'active', is_active: true })
    .count('id as cnt')
    .first();
  return parseInt(result.cnt, 10);
}

// Lists all enrollments for a class, joined with the student's user profile,
// class, and course details.
function listEnrollmentsByClass(classId, { status } = {}) {
  const query = db('enrollments as e')
    .join('users as u', 'u.id', 'e.student_user_id')
    .join('classes as c', 'c.id', 'e.class_id')
    .join('courses as cr', 'cr.id', 'c.course_id')
    .leftJoin('course_levels as cl', 'cl.id', 'c.course_level_id')
    .leftJoin('class_schedules as cs', 'cs.id', 'e.class_schedule_id')
    .where('e.class_id', classId)
    .where('e.is_active', true)
    .select(
      'e.id',
      'e.status',
      'e.enrolled_on',
      'e.withdrawn_on',
      'e.prior_level',
      'e.notes_ur',
      'e.created_at',
      'e.updated_at',
      'e.class_schedule_id',
      'u.id as student_user_id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
      'c.id as class_id',
      'c.name as class_name',
      'cr.name as course_name',
      'cr.fee as course_fee',
      'cl.title as course_level_title',
      'cs.day_of_week as preferred_day',
      'cs.start_time as preferred_start_time',
      'cs.end_time as preferred_end_time',
      db.raw(`(SELECT COALESCE(SUM(fp.amount_paid), 0)::float FROM fee_payments fp WHERE fp.enrollment_id = e.id AND fp.is_active = true) as total_paid`),
      db.raw(`(SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sessions as2 ON as2.id = ar.session_id WHERE ar.student_user_id = e.student_user_id AND as2.class_id = e.class_id AND ar.is_active = true AND as2.is_active = true) as attendance_total`),
      db.raw(`(SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sessions as2 ON as2.id = ar.session_id WHERE ar.student_user_id = e.student_user_id AND as2.class_id = e.class_id AND ar.is_active = true AND as2.is_active = true AND ar.status IN ('present', 'late')) as attendance_present`)
    )
    .orderBy('e.enrolled_on', 'desc')
    .orderBy('u.full_name', 'asc');
  if (status !== undefined) query.where('e.status', status);
  return query;
}

// Lists all enrollments for a center, joined with the student's user profile,
// class, and course details.
function listEnrollmentsByCenter(centerId, { status } = {}) {
  const query = db('enrollments as e')
    .join('users as u', 'u.id', 'e.student_user_id')
    .join('classes as c', 'c.id', 'e.class_id')
    .join('courses as cr', 'cr.id', 'c.course_id')
    .leftJoin('course_levels as cl', 'cl.id', 'c.course_level_id')
    .where('e.center_id', centerId)
    .where('e.is_active', true)
    .select(
      'e.id',
      'e.status',
      'e.enrolled_on',
      'e.withdrawn_on',
      'e.prior_level',
      'e.notes_ur',
      'e.created_at',
      'e.updated_at',
      'u.id as student_user_id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
      'c.id as class_id',
      'c.name as class_name',
      'cr.name as course_name',
      'cl.title as course_level_title'
    )
    .orderBy('e.enrolled_on', 'desc')
    .orderBy('u.full_name', 'asc');
    
  if (status !== undefined) query.where('e.status', status);
  return query;
}

// Lists all enrollments for a student, joined with class details.
function listEnrollmentsByStudent(studentUserId) {
  return db('enrollments as e')
    .join('classes as c', 'c.id', 'e.class_id')
    .where('e.student_user_id', studentUserId)
    .where('e.is_active', true)
    .select(
      'e.id',
      'e.status',
      'e.enrolled_on',
      'e.withdrawn_on',
      'e.prior_level',
      'e.notes_ur',
      'e.created_at',
      'e.updated_at',
      'c.id as class_id',
      'c.name as class_name',
      'c.name_ur as class_name_ur',
      'c.center_id',
    )
    .orderBy('e.enrolled_on', 'desc');
}

async function createEnrollment(data, trx = null) {
  const query = trx ? trx('enrollments') : db('enrollments');
  const [row] = await query.insert(data).returning('*');
  return row;
}

async function updateEnrollment(enrollmentId, data) {
  const [row] = await db('enrollments')
    .where({ id: enrollmentId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

module.exports = {
  getEnrollmentById,
  getActiveEnrollmentForStudent,
  countActiveEnrollments,
  listEnrollmentsByClass,
  listEnrollmentsByStudent,
  listEnrollmentsByCenter,
  createEnrollment,
  updateEnrollment,
};
