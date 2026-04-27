const db = require('../db/knex');

// ── Attendance Sessions ───────────────────────────────────────────────────────

// Duplicate guard for POST: one session per class per calendar day.
function getSessionByClassAndDate(classId, sessionDate) {
  return db('attendance_sessions')
    .where({ class_id: classId, session_date: sessionDate, is_active: true })
    .first();
}

function getSessionById(sessionId) {
  return db('attendance_sessions').where({ id: sessionId }).first();
}

async function createAttendanceSession(trx, data) {
  const [row] = await trx('attendance_sessions').insert(data).returning('*');
  return row;
}

// Bulk-insert all records in the same transaction as the session.
function bulkCreateAttendanceRecords(trx, rows) {
  return trx('attendance_records').insert(rows).returning('*');
}

// Returns all sessions for a class between from/to dates (inclusive), each
// joined with the teacher who marked it.
function listSessionsByClass(classId, { from, to } = {}) {
  const query = db('attendance_sessions as s')
    .join('users as u', 'u.id', 's.marked_by')
    .where('s.class_id', classId)
    .where('s.is_active', true)
    .select(
      's.id as session_id',
      's.session_date',
      's.marked_at',
      'u.id as marked_by_id',
      'u.full_name as marked_by_name',
    )
    .orderBy('s.session_date', 'desc');

  if (from) query.where('s.session_date', '>=', from);
  if (to)   query.where('s.session_date', '<=', to);
  return query;
}

// Fetches all individual records for a session, joined with student profiles.
function listRecordsBySession(sessionId) {
  return db('attendance_records as r')
    .join('users as u', 'u.id', 'r.student_user_id')
    .where('r.session_id', sessionId)
    .where('r.is_active', true)
    .select(
      'r.id as record_id',
      'r.status',
      'r.note_ur',
      'r.corrected_by',
      'r.corrected_at',
      'u.id as student_user_id',
      'u.full_name',
      'u.full_name_ur',
    )
    .orderBy('u.full_name', 'asc');
}

// ── Attendance Records ────────────────────────────────────────────────────────

function getAttendanceRecordById(recordId) {
  return db('attendance_records').where({ id: recordId }).first();
}

// Updates a single record and stamps the correcting teacher + timestamp.
async function updateAttendanceRecord(recordId, data) {
  const [row] = await db('attendance_records')
    .where({ id: recordId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Student Attendance ────────────────────────────────────────────────────────

// Returns all attendance records for a student, joined with session metadata.
// Filterable by class_id and a date range.
function getStudentAttendanceRecords(studentUserId, { classId, from, to } = {}) {
  const query = db('attendance_records as r')
    .join('attendance_sessions as s', 's.id', 'r.session_id')
    .where('r.student_user_id', studentUserId)
    .where('r.is_active', true)
    .where('s.is_active', true)
    .select(
      'r.id as record_id',
      'r.status',
      'r.note_ur',
      'r.corrected_by',
      'r.corrected_at',
      's.id as session_id',
      's.class_id',
      's.session_date',
    )
    .orderBy('s.session_date', 'desc');

  if (classId) query.where('s.class_id', classId);
  if (from)    query.where('s.session_date', '>=', from);
  if (to)      query.where('s.session_date', '<=', to);
  return query;
}

module.exports = {
  getSessionByClassAndDate,
  getSessionById,
  createAttendanceSession,
  bulkCreateAttendanceRecords,
  listSessionsByClass,
  listRecordsBySession,
  getAttendanceRecordById,
  updateAttendanceRecord,
  getStudentAttendanceRecords,
};
