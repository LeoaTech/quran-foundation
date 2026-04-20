const db = require('../db/knex');
const progressRepo = require('../repositories/progress.repository');
const notifyGuardianQueue = require('../jobs/notifyGuardian');
const { AppError } = require('../utils/errors');

async function createProgressSession({ teacherUserId, body }) {
  const { enrollment_id, class_id, session_date, classwork, homework } = body;

  // ── 1. Teacher ownership check ──────────────────────────────────────────────
  const classTeacher = await progressRepo.getClassTeacher(class_id, teacherUserId);
  if (!classTeacher) {
    throw new AppError(
      'FORBIDDEN',
      'You are not assigned to this class.',
      'آپ اس کلاس میں تفویض نہیں ہیں۔',
      403,
    );
  }

  // ── 2. Enrollment checks ────────────────────────────────────────────────────
  const enrollment = await progressRepo.getEnrollment(enrollment_id);
  if (!enrollment) {
    throw new AppError('NOT_FOUND', 'Enrollment not found.', 'اندراج نہیں ملا۔', 404);
  }
  if (enrollment.class_id !== class_id) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Enrollment does not belong to this class.',
      'یہ اندراج اس کلاس کا نہیں ہے۔',
      400,
      'enrollment_id',
    );
  }
  if (enrollment.status !== 'active') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Student enrollment is not active.',
      'طالبعلم کا اندراج فعال نہیں ہے۔',
      400,
      'enrollment_id',
    );
  }

  // ── 3. Duplicate session guard ──────────────────────────────────────────────
  const existing = await progressRepo.getExistingSession(enrollment_id, session_date);
  if (existing) {
    throw new AppError(
      'CONFLICT',
      'A progress session already exists for this student on this date.',
      'اس تاریخ کے لیے طالبعلم کا ریکارڈ پہلے سے موجود ہے۔',
      409,
    );
  }

  // ── 4. Validate homework criteria ───────────────────────────────────────────
  const criteria = await progressRepo.getActiveHomeworkCriteria(class_id);
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));
  const { scores } = homework;

  // Duplicate criteria_id check
  const seen = new Set();
  for (const s of scores) {
    if (seen.has(s.criteria_id)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Duplicate criteria_id "${s.criteria_id}" in scores.`,
        'اسکورز میں معیار کی شناخت دہرائی گئی ہے۔',
        400,
        'homework.scores',
      );
    }
    seen.add(s.criteria_id);
  }

  // Existence + bounds check per score
  for (const s of scores) {
    const criterion = criteriaMap.get(s.criteria_id);
    if (!criterion) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Criterion "${s.criteria_id}" does not exist or is inactive for this class.`,
        'مخصوص معیار اس کلاس میں موجود یا فعال نہیں ہے۔',
        400,
        'homework.scores',
      );
    }
    if (s.marks_obtained > criterion.max_marks) {
      throw new AppError(
        'VALIDATION_ERROR',
        `marks_obtained (${s.marks_obtained}) exceeds max_marks (${criterion.max_marks}) for criterion "${criterion.label}".`,
        `حاصل کردہ نمبر (${s.marks_obtained}) زیادہ سے زیادہ نمبروں (${criterion.max_marks}) سے زیادہ ہیں۔`,
        400,
        'homework.scores',
      );
    }
  }

  // ── 5. Pre-compute totals (before DB write) ─────────────────────────────────
  const homework_total = scores.reduce((sum, s) => sum + s.marks_obtained, 0);
  const homework_max   = scores.reduce((sum, s) => sum + criteriaMap.get(s.criteria_id).max_marks, 0);
  const homework_pct   = homework_max > 0 ? Math.round((homework_total / homework_max) * 100) : 0;

  // ── 6. Single transaction: session + entry + scores ─────────────────────────
  const { session, entry } = await db.transaction(async (trx) => {
    const session = await progressRepo.createProgressSession(trx, {
      enrollment_id,
      class_id,
      teacher_user_id: teacherUserId,
      session_date,
      cw_topic_id:    classwork.topic_id    ?? null,
      cw_subtopic_id: classwork.subtopic_id ?? null,
      cw_grade:       classwork.grade       ?? null,
      cw_note_ur:     classwork.note_ur     ?? null,
      cw_note_ar:     null,
      is_active:      true,
    });

    const entry = await progressRepo.createHomeworkEntry(trx, {
      session_id:       session.id,
      is_submitted:     false,
      due_date:         homework.due_date       ?? null,
      overall_note_ur:  homework.overall_note_ur ?? null,
      recorded_at:      new Date(),
      is_active:        true,
    });

    const scoreRows = scores.map((s) => ({
      homework_entry_id: entry.id,
      criteria_id:       s.criteria_id,
      marks_obtained:    s.marks_obtained,
      note_ur:           s.note_ur ?? null,
      is_active:         true,
    }));

    await progressRepo.createHomeworkScores(trx, scoreRows);

    return { session, entry };
  });

  // ── 7. Enqueue guardian notification (fire-and-forget) ──────────────────────
  // Fetch in parallel — both are read-only, happen after commit
  const [guardians, student] = await Promise.all([
    progressRepo.getGuardiansForStudent(enrollment.student_user_id),
    progressRepo.getStudentById(enrollment.student_user_id),
  ]);

  notifyGuardianQueue
    .add({
      session_id:        session.id,
      student_user_id:   enrollment.student_user_id,
      student_name:      student?.full_name    ?? '',
      student_name_ur:   student?.full_name_ur ?? null,
      class_id,
      session_date,
      cw_grade:          classwork.grade ?? null,
      homework_entry_id: entry.id,
      homework_total,
      homework_max,
      homework_pct,
      guardians,
    })
    .catch((err) => console.error('[notify-guardian] Failed to enqueue:', err.message));

  // ── 8. Response ─────────────────────────────────────────────────────────────
  return {
    session_id:        session.id,
    homework_entry_id: entry.id,
    homework_total,
    homework_max,
    homework_pct,
  };
}

module.exports = { createProgressSession };
