const db          = require('../db/knex');
const repo         = require('../repositories/assessments.repository');
const classRepo    = require('../repositories/classes.repository');
const { AppError } = require('../utils/errors');

// ── Helpers ───────────────────────────────────────────────────────────────────

function notFound(entity = 'Resource') {
  return new AppError('NOT_FOUND', `${entity} not found.`, 'مطلوبہ وسیلہ نہیں ملا۔', 404);
}

function forbidden() {
  return new AppError(
    'FORBIDDEN',
    'You do not have access to perform this action.',
    'آپ کو یہ عمل کرنے کی اجازت نہیں ہے۔',
    403,
  );
}

async function requireAssessment(assessmentId) {
  const assessment = await repo.getAssessmentById(assessmentId);
  if (!assessment) throw notFound('Assessment');
  return assessment;
}

async function requireClass(classId) {
  const cls = await classRepo.getClassById(classId);
  if (!cls || !cls.is_active) throw notFound('Class');
  return cls;
}

// center_manager must belong to the same center as the class; teacher must be assigned.
async function assertWriteAccess(user, classId) {
  if (user.roles.includes('super_admin')) return;

  const cls = await classRepo.getClassById(classId);

  if (user.roles.includes('center_manager')) {
    if (user.center_id !== cls.center_id) throw forbidden();
    return;
  }

  if (user.roles.includes('teacher')) {
    const entry = await classRepo.getClassTeacherEntry(classId, user.id);
    if (!entry) throw forbidden();
    return;
  }

  throw forbidden();
}

// Read access is the same as write access for assessments.
const assertReadAccess = assertWriteAccess;

// Enforces assessment-type-specific score/oral_grade rule for a single result item.
function assertTypeGradeConsistency(assessmentType, result) {
  if (assessmentType === 'oral') {
    if (result.score !== undefined && result.score !== null) {
      throw new AppError(
        'VALIDATION_ERROR',
        'score must not be set for oral assessments.',
        'زبانی امتحان میں نمبر درج نہیں کیے جا سکتے۔',
        400,
        'score',
      );
    }
    if (!result.oral_grade) {
      throw new AppError(
        'VALIDATION_ERROR',
        'oral_grade is required for oral assessments.',
        'زبانی امتحان میں درجہ لازمی ہے۔',
        400,
        'oral_grade',
      );
    }
  } else {
    // written | topic_test
    if (result.oral_grade !== undefined && result.oral_grade !== null) {
      throw new AppError(
        'VALIDATION_ERROR',
        'oral_grade must not be set for written/topic_test assessments.',
        'تحریری امتحان میں زبانی درجہ درج نہیں کیا جا سکتا۔',
        400,
        'oral_grade',
      );
    }
    if (result.score === undefined || result.score === null) {
      throw new AppError(
        'VALIDATION_ERROR',
        'score is required for written/topic_test assessments.',
        'تحریری امتحان میں نمبر لازمی ہیں۔',
        400,
        'score',
      );
    }
  }
}

// ── POST /classes/:class_id/assessments ───────────────────────────────────────

async function createAssessment({ user, classId, body }) {
  await requireClass(classId);
  await assertWriteAccess(user, classId);

  const {
    title,
    title_ur,
    type,
    assessment_date,
    max_score,
    instructions_ur,
  } = body;

  return repo.createAssessment({
    class_id:        classId,
    created_by:      user.id,
    title,
    title_ur:        title_ur        ?? null,
    type:            type            ?? null,
    assessment_date: assessment_date ?? null,
    max_score:       max_score       ?? null,
    instructions_ur: instructions_ur ?? null,
    is_active:       true,
  });
}

// ── GET /classes/:class_id/assessments ───────────────────────────────────────

async function listAssessmentsByClass({ user, classId, query = {} }) {
  await requireClass(classId);
  await assertReadAccess(user, classId);

  const { from, to } = query;
  return repo.listAssessmentsByClass(classId, { from, to });
}

// ── GET /assessments/:assessment_id ──────────────────────────────────────────

async function getAssessment({ user, assessmentId }) {
  const assessment = await requireAssessment(assessmentId);
  await assertReadAccess(user, assessment.class_id);
  return assessment;
}

// ── POST /assessments/:assessment_id/results ─────────────────────────────────

async function createResults({ user, assessmentId, body }) {
  const assessment = await requireAssessment(assessmentId);
  await assertWriteAccess(user, assessment.class_id);

  const { results } = body;

  // Enforce type-specific score/oral_grade consistency for every result item.
  for (const r of results) {
    assertTypeGradeConsistency(assessment.type, r);
  }

  // Detect duplicates within the request itself.
  const seenStudents = new Set();
  for (const r of results) {
    if (seenStudents.has(r.student_user_id)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Duplicate student_user_id "${r.student_user_id}" in results array.`,
        'نتائج میں طالبعلم کی شناخت دہرائی گئی ہے۔',
        400,
        'results',
      );
    }
    seenStudents.add(r.student_user_id);
  }

  // Check each student for an existing result row (409 RESULT_EXISTS).
  await Promise.all(
    results.map(async (r) => {
      const existing = await repo.getResultByStudentAndAssessment(assessmentId, r.student_user_id);
      if (existing) {
        throw new AppError(
          'RESULT_EXISTS',
          `A result already exists for student "${r.student_user_id}" in this assessment.`,
          'اس طالبعلم کا نتیجہ پہلے سے موجود ہے۔',
          409,
        );
      }
    }),
  );

  // Score ceiling check (only for score-based assessments).
  if (assessment.type !== 'oral' && assessment.max_score != null) {
    for (const r of results) {
      if (r.score !== undefined && r.score > assessment.max_score) {
        throw new AppError(
          'VALIDATION_ERROR',
          `score (${r.score}) exceeds max_score (${assessment.max_score}) for this assessment.`,
          `نمبر (${r.score}) زیادہ سے زیادہ نمبروں (${assessment.max_score}) سے زیادہ ہیں۔`,
          400,
          'score',
        );
      }
    }
  }

  const rows = results.map((r) => ({
    assessment_id:      assessmentId,
    student_user_id:    r.student_user_id,
    examiner_user_id:   r.examiner_user_id ?? user.id,
    score:              r.score              ?? null,
    oral_grade:         r.oral_grade         ?? null,
    topic_tested_id:    r.topic_tested_id    ?? null,
    subtopic_tested_id: r.subtopic_tested_id ?? null,
    remarks_ur:         r.remarks_ur         ?? null,
    remarks_ar:         r.remarks_ar         ?? null,
    is_active:          true,
  }));

  return db.transaction((trx) => repo.bulkCreateResults(trx, rows));
}

// ── GET /assessments/:assessment_id/results ──────────────────────────────────

async function listResults({ user, assessmentId }) {
  const assessment = await requireAssessment(assessmentId);
  await assertReadAccess(user, assessment.class_id);
  return repo.listResultsByAssessment(assessmentId);
}

// ── PATCH /assessments/:assessment_id/results/:result_id ─────────────────────

async function updateResult({ user, assessmentId, resultId, body }) {
  const assessment = await requireAssessment(assessmentId);
  await assertWriteAccess(user, assessment.class_id);

  const result = await repo.getResultById(resultId);
  if (!result) throw notFound('Assessment result');
  if (result.assessment_id !== assessmentId) throw notFound('Assessment result');

  // Merge proposed values with existing so type-consistency check sees the full picture.
  const merged = {
    score:      'score'      in body ? body.score      : result.score,
    oral_grade: 'oral_grade' in body ? body.oral_grade : result.oral_grade,
  };
  assertTypeGradeConsistency(assessment.type, merged);

  // Score ceiling check.
  if (
    assessment.type !== 'oral' &&
    assessment.max_score != null &&
    body.score !== undefined &&
    body.score > assessment.max_score
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      `score (${body.score}) exceeds max_score (${assessment.max_score}) for this assessment.`,
      `نمبر (${body.score}) زیادہ سے زیادہ نمبروں (${assessment.max_score}) سے زیادہ ہیں۔`,
      400,
      'score',
    );
  }

  return repo.updateResult(resultId, body);
}

// ── GET /students/:user_id/assessments ───────────────────────────────────────

async function listStudentAssessments({ user, studentUserId, query = {} }) {
  const { class_id, from, to } = query;
  return repo.listAssessmentsByStudent(studentUserId, { classId: class_id, from, to });
}

module.exports = {
  createAssessment,
  listAssessmentsByClass,
  getAssessment,
  createResults,
  listResults,
  updateResult,
  listStudentAssessments,
};
