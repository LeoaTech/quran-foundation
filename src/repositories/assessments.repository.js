const db = require('../db/knex');

// ── Assessments ───────────────────────────────────────────────────────────────

function listAssessmentsByClass(classId, { from, to } = {}) {
  const query = db('assessments')
    .where({ class_id: classId, is_active: true })
    .orderBy('assessment_date', 'desc');
  if (from) query.where('assessment_date', '>=', from);
  if (to)   query.where('assessment_date', '<=', to);
  return query;
}

function getAssessmentById(assessmentId) {
  return db('assessments').where({ id: assessmentId, is_active: true }).first();
}

async function createAssessment(data) {
  const [row] = await db('assessments').insert(data).returning('*');
  return row;
}

// ── Assessment Results ────────────────────────────────────────────────────────

function getResultByStudentAndAssessment(assessmentId, studentUserId) {
  return db('assessment_results')
    .where({ assessment_id: assessmentId, student_user_id: studentUserId, is_active: true })
    .first();
}

function getResultById(resultId) {
  return db('assessment_results').where({ id: resultId, is_active: true }).first();
}

function listResultsByAssessment(assessmentId) {
  return db('assessment_results as ar')
    .join('users as u', 'u.id', 'ar.student_user_id')
    .where('ar.assessment_id', assessmentId)
    .where('ar.is_active', true)
    .select(
      'ar.id',
      'ar.assessment_id',
      'ar.student_user_id',
      'u.full_name as student_full_name',
      'u.full_name_ur as student_full_name_ur',
      'ar.examiner_user_id',
      'ar.score',
      'ar.oral_grade',
      'ar.topic_tested_id',
      'ar.subtopic_tested_id',
      'ar.remarks_ur',
      'ar.remarks_ar',
      'ar.created_at',
      'ar.updated_at',
    )
    .orderBy('u.full_name', 'asc');
}

// For GET /students/:user_id/assessments — joins through results to assessments.
function listAssessmentsByStudent(studentUserId, { classId, from, to } = {}) {
  const query = db('assessment_results as ar')
    .join('assessments as a', 'a.id', 'ar.assessment_id')
    .where('ar.student_user_id', studentUserId)
    .where('ar.is_active', true)
    .where('a.is_active', true)
    .select(
      'a.id as assessment_id',
      'a.class_id',
      'a.title',
      'a.title_ur',
      'a.type',
      'a.assessment_date',
      'a.max_score',
      'ar.id as result_id',
      'ar.score',
      'ar.oral_grade',
      'ar.topic_tested_id',
      'ar.subtopic_tested_id',
      'ar.remarks_ur',
      'ar.remarks_ar',
      'ar.examiner_user_id',
      'ar.created_at',
    )
    .orderBy('a.assessment_date', 'desc');

  if (classId) query.where('a.class_id', classId);
  if (from)    query.where('a.assessment_date', '>=', from);
  if (to)      query.where('a.assessment_date', '<=', to);
  return query;
}

function bulkCreateResults(trx, rows) {
  return trx('assessment_results').insert(rows).returning('*');
}

async function updateResult(resultId, data) {
  const [row] = await db('assessment_results')
    .where({ id: resultId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

module.exports = {
  listAssessmentsByClass,
  getAssessmentById,
  createAssessment,
  getResultByStudentAndAssessment,
  getResultById,
  listResultsByAssessment,
  listAssessmentsByStudent,
  bulkCreateResults,
  updateResult,
};
