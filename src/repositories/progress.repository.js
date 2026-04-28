const db = require('../db/knex');

// ── Ownership & lookup helpers ────────────────────────────────────────────────

// Is this teacher assigned to this class?
function getClassTeacher(classId, teacherUserId) {
  return db('class_teachers')
    .where({ class_id: classId, teacher_user_id: teacherUserId, is_active: true })
    .first();
}

function getEnrollment(enrollmentId) {
  return db('enrollments').where({ id: enrollmentId, is_active: true }).first();
}

// Returns all active criteria for the class, ordered for display.
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

// Guardians linked to a student, joined with their user accounts.
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

// ── Progress sessions ─────────────────────────────────────────────────────────

function getSessionById(sessionId) {
  return db('progress_sessions').where({ id: sessionId, is_active: true }).first();
}

async function createProgressSession(trx, data) {
  const [row] = await trx('progress_sessions').insert(data).returning('*');
  return row;
}

async function updateProgressSession(sessionId, data) {
  const [row] = await db('progress_sessions')
    .where({ id: sessionId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// Lists sessions for a student (via enrollment), optionally filtered.
function listProgressByStudent(studentUserId, { classId, from, to } = {}) {
  const query = db('progress_sessions as ps')
    .join('enrollments as e', 'e.id', 'ps.enrollment_id')
    .where('e.student_user_id', studentUserId)
    .where('ps.is_active', true)
    .select(
      'ps.id',
      'ps.enrollment_id',
      'ps.class_id',
      'ps.teacher_user_id',
      'ps.session_date',
      'ps.cw_topic_id',
      'ps.cw_subtopic_id',
      'ps.cw_grade',
      'ps.cw_note_ur',
      'ps.created_at',
      'ps.updated_at',
    )
    .orderBy('ps.session_date', 'desc');

  if (classId) query.where('ps.class_id', classId);
  if (from)    query.where('ps.session_date', '>=', from);
  if (to)      query.where('ps.session_date', '<=', to);
  return query;
}

// ── Homework entries ──────────────────────────────────────────────────────────

function getHomeworkEntryBySessionId(sessionId) {
  return db('homework_entries').where({ session_id: sessionId, is_active: true }).first();
}

function getHomeworkEntryById(entryId) {
  return db('homework_entries').where({ id: entryId, is_active: true }).first();
}

// Fetch homework entries for a set of session IDs (for bulk include).
function getHomeworkEntriesForSessions(sessionIds) {
  if (!sessionIds.length) return Promise.resolve([]);
  return db('homework_entries')
    .whereIn('session_id', sessionIds)
    .where('is_active', true);
}

async function createHomeworkEntry(trx, data) {
  const [row] = await trx('homework_entries').insert(data).returning('*');
  return row;
}

async function updateHomeworkEntry(entryId, data) {
  const [row] = await db('homework_entries')
    .where({ id: entryId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Homework scores ───────────────────────────────────────────────────────────

// Scores joined with criteria for label/max_marks — used for session detail view.
function getScoresByEntryId(entryId) {
  return db('homework_scores as hs')
    .join('homework_criteria as hc', 'hc.id', 'hs.criteria_id')
    .where('hs.homework_entry_id', entryId)
    .where('hs.is_active', true)
    .select(
      'hs.id',
      'hs.criteria_id',
      'hc.label',
      'hc.label_ur',
      'hc.max_marks',
      'hs.marks_obtained',
      'hs.note_ur',
    )
    .orderBy('hc.display_order', 'asc');
}

// Bulk fetch for multiple entry IDs (avoid N+1 in getStudentProgress).
function getScoresForEntries(entryIds) {
  if (!entryIds.length) return Promise.resolve([]);
  return db('homework_scores as hs')
    .join('homework_criteria as hc', 'hc.id', 'hs.criteria_id')
    .whereIn('hs.homework_entry_id', entryIds)
    .where('hs.is_active', true)
    .select(
      'hs.id',
      'hs.homework_entry_id',
      'hs.criteria_id',
      'hc.label',
      'hc.label_ur',
      'hc.max_marks',
      'hs.marks_obtained',
      'hs.note_ur',
    )
    .orderBy('hc.display_order', 'asc');
}

// Single score joined with criteria so the service can check max_marks.
function getHomeworkScoreById(scoreId) {
  return db('homework_scores as hs')
    .join('homework_criteria as hc', 'hc.id', 'hs.criteria_id')
    .where('hs.id', scoreId)
    .where('hs.is_active', true)
    .select(
      'hs.id',
      'hs.homework_entry_id',
      'hs.criteria_id',
      'hc.label',
      'hc.label_ur',
      'hc.max_marks',
      'hc.class_id',
      'hs.marks_obtained',
      'hs.note_ur',
    )
    .first();
}

async function updateHomeworkScore(scoreId, data) {
  const [row] = await db('homework_scores')
    .where({ id: scoreId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

function createHomeworkScores(trx, rows) {
  return trx('homework_scores').insert(rows);
}

module.exports = {
  // Ownership & lookups
  getClassTeacher,
  getEnrollment,
  getActiveHomeworkCriteria,
  getExistingSession,
  getStudentById,
  getGuardiansForStudent,
  // Progress sessions
  getSessionById,
  createProgressSession,
  updateProgressSession,
  listProgressByStudent,
  // Homework entries
  getHomeworkEntryBySessionId,
  getHomeworkEntryById,
  getHomeworkEntriesForSessions,
  createHomeworkEntry,
  updateHomeworkEntry,
  // Homework scores
  getScoresByEntryId,
  getScoresForEntries,
  getHomeworkScoreById,
  updateHomeworkScore,
  createHomeworkScores,
};
