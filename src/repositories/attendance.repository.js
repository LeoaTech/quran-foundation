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
// joined with the teacher who marked it + attendance summary counts + topic.
function listSessionsByClass(classId, { from, to } = {}) {
  const query = db('attendance_sessions as s')
    .join('users as u', 'u.id', 's.marked_by')
    .leftJoin(
      db('attendance_records as ar2')
        .where('ar2.is_active', true)
        .select(
          'ar2.session_id',
          db.raw("COUNT(CASE WHEN ar2.status = 'present' THEN 1 END)::int AS cnt_present"),
          db.raw("COUNT(CASE WHEN ar2.status = 'absent'  THEN 1 END)::int AS cnt_absent"),
          db.raw("COUNT(CASE WHEN ar2.status = 'late'    THEN 1 END)::int AS cnt_late"),
          db.raw('COUNT(ar2.id)::int AS cnt_total'),
        )
        .groupBy('ar2.session_id')
        .as('agg'),
      'agg.session_id',
      's.id',
    )
    .leftJoin(
      // Pull the first cw_topic_id/title recorded for any student on this session date + class
      db('progress_sessions as ps')
        .join('topics as tp', 'tp.id', 'ps.cw_topic_id')
        .select(
          'ps.class_id',
          'ps.session_date as ps_date',
          db.raw("MIN(tp.title) AS topic_title"),
          db.raw("MIN(tp.title_ar) AS topic_title_ar"),
        )
        .whereNotNull('ps.cw_topic_id')
        .groupBy('ps.class_id', 'ps.session_date')
        .as('ptopic'),
      function () {
        this.on('ptopic.class_id', '=', 's.class_id')
            .andOn('ptopic.ps_date', '=', 's.session_date');
      },
    )
    .where('s.class_id', classId)
    .where('s.is_active', true)
    .select(
      's.id as session_id',
      's.session_date',
      's.marked_at',
      'u.id as marked_by_id',
      'u.full_name as marked_by_name',
      db.raw('COALESCE(agg.cnt_present, 0) AS cnt_present'),
      db.raw('COALESCE(agg.cnt_absent,  0) AS cnt_absent'),
      db.raw('COALESCE(agg.cnt_late,    0) AS cnt_late'),
      db.raw('COALESCE(agg.cnt_total,   0) AS cnt_total'),
      db.raw('ptopic.topic_title'),
      db.raw('ptopic.topic_title_ar'),
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
