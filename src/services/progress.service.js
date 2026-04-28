const db = require('../db/knex');
const progressRepo    = require('../repositories/progress.repository');
const classRepo       = require('../repositories/classes.repository');
const notifyGuardianQueue = require('../jobs/notifyGuardian');
const reportCache     = require('../utils/reportCache');
const { AppError }    = require('../utils/errors');

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

// Verifies the session exists and returns it.
async function requireSession(sessionId) {
  const session = await progressRepo.getSessionById(sessionId);
  if (!session) throw notFound('Progress session');
  return session;
}

// For write ops: teacher must be in class_teachers OR be super_admin/center_manager.
async function assertWriteAccess(user, session) {
  if (user.roles.includes('super_admin')) return;

  const cls = await classRepo.getClassById(session.class_id);

  if (user.roles.includes('center_manager')) {
    if (user.center_id !== cls.center_id) throw forbidden();
    return;
  }

  if (user.roles.includes('teacher')) {
    const entry = await progressRepo.getClassTeacher(session.class_id, user.id);
    if (!entry) throw forbidden();
    return;
  }

  throw forbidden();
}

// For read ops: same as write PLUS the original teacher_user_id may always read.
async function assertReadAccess(user, session) {
  if (user.roles.includes('super_admin')) return;
  if (session.teacher_user_id === user.id) return;

  const cls = await classRepo.getClassById(session.class_id);

  if (user.roles.includes('center_manager')) {
    if (user.center_id !== cls.center_id) throw forbidden();
    return;
  }

  if (user.roles.includes('teacher')) {
    const entry = await progressRepo.getClassTeacher(session.class_id, user.id);
    if (!entry) throw forbidden();
    return;
  }

  // Students/guardians viewing their own session are not blocked here;
  // the service caller may decide to allow it by skipping this check.
}

// Computes homework totals from a scores array (joined with max_marks).
function computeTotals(scores) {
  const homework_total = scores.reduce((s, r) => s + r.marks_obtained, 0);
  const homework_max   = scores.reduce((s, r) => s + r.max_marks, 0);
  const homework_pct   = homework_max > 0
    ? Math.round((homework_total / homework_max) * 1000) / 10
    : 0;
  return { homework_total, homework_max, homework_pct };
}

// ── POST /progress-sessions ───────────────────────────────────────────────────

async function createProgressSession({ teacherUserId, body }) {
  const { enrollment_id, class_id, session_date, classwork, homework } = body;

  // ── 1. Teacher ownership check ─────────────────────────────────────────────
  const classTeacher = await progressRepo.getClassTeacher(class_id, teacherUserId);
  if (!classTeacher) {
    throw new AppError(
      'FORBIDDEN',
      'You are not assigned to this class.',
      'آپ اس کلاس میں تفویض نہیں ہیں۔',
      403,
    );
  }

  // ── 2. Enrollment checks ───────────────────────────────────────────────────
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

  // ── 3. Duplicate session guard ─────────────────────────────────────────────
  const existing = await progressRepo.getExistingSession(enrollment_id, session_date);
  if (existing) {
    throw new AppError(
      'CONFLICT',
      'A progress session already exists for this student on this date.',
      'اس تاریخ کے لیے طالبعلم کا ریکارڈ پہلے سے موجود ہے۔',
      409,
    );
  }

  // ── 4. Validate homework criteria ──────────────────────────────────────────
  const criteria = await progressRepo.getActiveHomeworkCriteria(class_id);
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));
  const { scores } = homework;

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

  // ── 5. Pre-compute totals ──────────────────────────────────────────────────
  const scoredCriteria = scores.map((s) => ({
    ...s,
    max_marks: criteriaMap.get(s.criteria_id).max_marks,
  }));
  const { homework_total, homework_max, homework_pct } = computeTotals(scoredCriteria);

  // ── 6. Single transaction ──────────────────────────────────────────────────
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
      session_id:      session.id,
      is_submitted:    false,
      due_date:        homework.due_date        ?? null,
      overall_note_ur: homework.overall_note_ur ?? null,
      recorded_at:     new Date(),
      is_active:       true,
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

  // ── 7. Invalidate report caches (fire-and-forget) ─────────────────────────
  reportCache.invalidateCenterReports(enrollment.center_id)
    .catch((err) => console.error('[reportCache] center invalidation failed:', err.message));
  reportCache.invalidateStudentReport(enrollment.student_user_id)
    .catch((err) => console.error('[reportCache] student invalidation failed:', err.message));

  // ── 8. Enqueue guardian notification (fire-and-forget) ────────────────────
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

  // ── 9. Response ────────────────────────────────────────────────────────────
  return {
    session_id:        session.id,
    homework_entry_id: entry.id,
    homework_total,
    homework_max,
    homework_pct,
  };
}

// ── GET /progress-sessions/:session_id ────────────────────────────────────────

async function getProgressSession({ user, sessionId }) {
  const session = await requireSession(sessionId);
  await assertReadAccess(user, session);

  const homeworkEntry = await progressRepo.getHomeworkEntryBySessionId(sessionId);
  if (!homeworkEntry) {
    return { ...session, homework_entry: null };
  }

  const scores = await progressRepo.getScoresByEntryId(homeworkEntry.id);
  const { homework_total, homework_max, homework_pct } = computeTotals(scores);

  return {
    ...session,
    homework_entry: {
      ...homeworkEntry,
      homework_total,
      homework_max,
      homework_pct,
      scores,
    },
  };
}

// ── PATCH /progress-sessions/:session_id ─────────────────────────────────────

async function updateProgressSession({ user, sessionId, body }) {
  const session = await requireSession(sessionId);
  await assertWriteAccess(user, session);

  return progressRepo.updateProgressSession(sessionId, body);
}

// ── GET /students/:user_id/progress ──────────────────────────────────────────

async function getStudentProgress({ user, studentUserId, query = {} }) {
  const { class_id, from, to, include } = query;

  const sessions = await progressRepo.listProgressByStudent(studentUserId, { classId: class_id, from, to });

  if (include !== 'homework_scores') {
    return sessions;
  }

  // Bulk-fetch entries and scores — 3 queries regardless of session count.
  const sessionIds = sessions.map((s) => s.id);
  const entries    = await progressRepo.getHomeworkEntriesForSessions(sessionIds);
  const entryIds   = entries.map((e) => e.id);
  const allScores  = await progressRepo.getScoresForEntries(entryIds);

  // Group scores by entry id.
  const scoresByEntryId = new Map();
  for (const score of allScores) {
    const list = scoresByEntryId.get(score.homework_entry_id) ?? [];
    list.push(score);
    scoresByEntryId.set(score.homework_entry_id, list);
  }

  // Group entries by session id.
  const entryBySessionId = new Map();
  for (const entry of entries) {
    const scores = scoresByEntryId.get(entry.id) ?? [];
    const { homework_total, homework_max, homework_pct } = computeTotals(scores);
    entryBySessionId.set(entry.session_id, {
      ...entry,
      homework_total,
      homework_max,
      homework_pct,
      scores,
    });
  }

  return sessions.map((s) => ({
    ...s,
    homework_entry: entryBySessionId.get(s.id) ?? null,
  }));
}

// ── PATCH /homework-entries/:entry_id ─────────────────────────────────────────

async function updateHomeworkEntry({ user, entryId, body }) {
  const entry = await progressRepo.getHomeworkEntryById(entryId);
  if (!entry) throw notFound('Homework entry');

  const session = await requireSession(entry.session_id);
  await assertWriteAccess(user, session);

  return progressRepo.updateHomeworkEntry(entryId, body);
}

// ── PATCH /homework-entries/:entry_id/scores/:score_id ───────────────────────

async function updateHomeworkScore({ user, entryId, scoreId, body }) {
  const score = await progressRepo.getHomeworkScoreById(scoreId);
  if (!score) throw notFound('Homework score');

  if (score.homework_entry_id !== entryId) {
    throw notFound('Homework score');
  }

  const entry   = await progressRepo.getHomeworkEntryById(entryId);
  const session = await requireSession(entry.session_id);
  await assertWriteAccess(user, session);

  // Bounds check for marks_obtained.
  if (body.marks_obtained !== undefined && body.marks_obtained > score.max_marks) {
    throw new AppError(
      'VALIDATION_ERROR',
      `marks_obtained (${body.marks_obtained}) exceeds max_marks (${score.max_marks}) for criterion "${score.label}".`,
      `حاصل کردہ نمبر (${body.marks_obtained}) زیادہ سے زیادہ نمبروں (${score.max_marks}) سے زیادہ ہیں۔`,
      400,
      'marks_obtained',
    );
  }

  const updated = await progressRepo.updateHomeworkScore(scoreId, body);

  // Recompute entry totals after the update.
  const allScores = await progressRepo.getScoresByEntryId(entryId);
  const { homework_total, homework_max, homework_pct } = computeTotals(allScores);

  return {
    ...updated,
    label:          score.label,
    label_ur:       score.label_ur,
    max_marks:      score.max_marks,
    homework_total,
    homework_max,
    homework_pct,
  };
}

module.exports = {
  createProgressSession,
  getProgressSession,
  updateProgressSession,
  getStudentProgress,
  updateHomeworkEntry,
  updateHomeworkScore,
};
