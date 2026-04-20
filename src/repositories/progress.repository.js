const db = require('../db/knex');

// Ownership — is this teacher assigned to this class?
function getClassTeacher(classId, teacherUserId) {
  return db('class_teachers')
    .where({ class_id: classId, teacher_user_id: teacherUserId, is_active: true })
    .first();
}

function getEnrollment(enrollmentId) {
  return db('enrollments').where({ id: enrollmentId, is_active: true }).first();
}

// Returns all active criteria for the class, ordered for display
function getActiveHomeworkCriteria(classId) {
  return db('homework_criteria')
    .where({ class_id: classId, is_active: true })
    .orderBy('display_order')
    .select('id', 'label', 'label_ur', 'max_marks');
}

function getExistingSession(enrollmentId, sessionDate) {
  return db('progress_sessions')
    .where({ enrollment_id: enrollmentId, session_date: sessionDate })
    .first('id');
}

function getStudentById(userId) {
  return db('users')
    .where({ id: userId, is_active: true })
    .first('id', 'full_name', 'full_name_ur', 'phone', 'whatsapp', 'preferred_lang');
}

// Guardians linked to a student, joined with their user accounts
function getGuardiansForStudent(studentUserId) {
  return db('guardians as g')
    .join('users as u', 'u.id', 'g.guardian_user_id')
    .where('g.student_user_id', studentUserId)
    .where('u.is_active', true)
    .select(
      'u.full_name', 'u.full_name_ur',
      'u.phone', 'u.whatsapp', 'u.preferred_lang',
      'g.relation', 'g.is_primary',
    );
}

async function createProgressSession(trx, data) {
  const [row] = await trx('progress_sessions').insert(data).returning('*');
  return row;
}

async function createHomeworkEntry(trx, data) {
  const [row] = await trx('homework_entries').insert(data).returning('*');
  return row;
}

function createHomeworkScores(trx, rows) {
  return trx('homework_scores').insert(rows);
}

module.exports = {
  getClassTeacher,
  getEnrollment,
  getActiveHomeworkCriteria,
  getExistingSession,
  getStudentById,
  getGuardiansForStudent,
  createProgressSession,
  createHomeworkEntry,
  createHomeworkScores,
};
