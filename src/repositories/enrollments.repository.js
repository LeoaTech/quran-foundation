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

// Lists all enrollments for a class, joined with the student's user profile.
function listEnrollmentsByClass(classId, { status } = {}) {
  const query = db('enrollments as e')
    .join('users as u', 'u.id', 'e.student_user_id')
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
      'u.id as student_user_id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
    )
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

async function createEnrollment(data) {
  const [row] = await db('enrollments').insert(data).returning('*');
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
  createEnrollment,
  updateEnrollment,
};
