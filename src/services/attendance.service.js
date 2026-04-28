const db          = require('../db/knex');
const repo        = require('../repositories/attendance.repository');
const classRepo   = require('../repositories/classes.repository');
const reportCache = require('../utils/reportCache');
const { AppError } = require('../utils/errors');

// ── Helpers ───────────────────────────────────────────────────────────────────

function notFound(entity = 'Resource') {
  return new AppError(
    'NOT_FOUND',
    `${entity} not found.`,
    'مطلوبہ وسیلہ نہیں ملا۔',
    404,
  );
}

function forbidden() {
  return new AppError(
    'FORBIDDEN',
    'You do not have access to perform this action.',
    'آپ کو یہ عمل کرنے کی اجازت نہیں ہے۔',
    403,
  );
}

function assertCenterAccess(user, centerId) {
  if (user.roles.includes('super_admin')) return;
  if (user.center_id !== centerId) throw forbidden();
}

async function requireClass(classId) {
  const cls = await classRepo.getClassById(classId);
  if (!cls) throw notFound('Class');
  return cls;
}

// Teacher must have an active class_teachers row.
async function assertTeacherOwnership(user, classId) {
  if (user.roles.includes('super_admin') || user.roles.includes('center_manager')) return;
  const entry = await classRepo.getClassTeacherEntry(classId, user.id);
  if (!entry) throw forbidden();
}

// ── Service functions ─────────────────────────────────────────────────────────

async function createAttendanceSession({ user, classId, body }) {
  const { session_date, records } = body;

  const cls = await requireClass(classId);
  assertCenterAccess(user, cls.center_id);
  await assertTeacherOwnership(user, classId);

  // Rule 1: 409 if a session already exists for this class + date.
  const existing = await repo.getSessionByClassAndDate(classId, session_date);
  if (existing) {
    throw new AppError(
      'SESSION_EXISTS',
      'An attendance session already exists for this class on this date.',
      'اس تاریخ کے لیے اس کلاس کا حاضری سیشن پہلے سے موجود ہے۔',
      409,
    );
  }

  const now = new Date();

  const { session, attendanceRecords } = await db.transaction(async (trx) => {
    const session = await repo.createAttendanceSession(trx, {
      class_id:    classId,
      center_id:   cls.center_id,
      marked_by:   user.id,
      session_date,
      marked_at:   now,
      is_active:   true,
    });

    const rows = records.map((r) => ({
      session_id:       session.id,
      student_user_id:  r.student_user_id,
      status:           r.status,
      note_ur:          r.note_ur ?? null,
      is_active:        true,
    }));

    const attendanceRecords = await repo.bulkCreateAttendanceRecords(trx, rows);
    return { session, attendanceRecords };
  });

  const total   = attendanceRecords.length;
  const present = attendanceRecords.filter((r) => r.status === 'present').length;
  const absent  = attendanceRecords.filter((r) => r.status === 'absent').length;
  const late    = attendanceRecords.filter((r) => r.status === 'late').length;

  // Invalidate report caches for this center (fire-and-forget).
  reportCache.invalidateCenterReports(cls.center_id)
    .catch((err) => console.error('[reportCache] invalidation failed:', err.message));

  return {
    session_id:   session.id,
    session_date: session.session_date,
    total,
    present,
    absent,
    late,
  };
}

async function listSessionsByClass({ user, classId, query = {} }) {
  const cls = await requireClass(classId);
  assertCenterAccess(user, cls.center_id);

  const { from, to } = query;
  const sessions = await repo.listSessionsByClass(classId, { from, to });

  // Attach the individual records to each session.
  const results = await Promise.all(
    sessions.map(async (s) => {
      const records = await repo.listRecordsBySession(s.session_id);
      return { ...s, records };
    }),
  );

  return results;
}

async function correctRecord({ user, sessionId, recordId, body }) {
  // Verify the record belongs to the stated session.
  const record = await repo.getAttendanceRecordById(recordId);
  if (!record || !record.is_active) throw notFound('Attendance record');
  if (record.session_id !== sessionId) throw notFound('Attendance record');

  // Verify the session's class is accessible.
  const session = await repo.getSessionById(sessionId);
  if (!session || !session.is_active) throw notFound('Attendance session');

  const cls = await requireClass(session.class_id);
  assertCenterAccess(user, cls.center_id);
  await assertTeacherOwnership(user, session.class_id);

  return repo.updateAttendanceRecord(recordId, {
    status:       body.status   ?? record.status,
    note_ur:      body.note_ur  !== undefined ? body.note_ur : record.note_ur,
    corrected_by: user.id,
    corrected_at: new Date(),
  });
}

// Rule 2: summary object with attendance_pct rounded to 1 decimal place.
async function getStudentAttendance({ user, studentUserId, query = {} }) {
  const { class_id, from, to } = query;

  const records = await repo.getStudentAttendanceRecords(studentUserId, { classId: class_id, from, to });

  const total_sessions = records.length;
  const present  = records.filter((r) => r.status === 'present').length;
  const absent   = records.filter((r) => r.status === 'absent').length;
  const late     = records.filter((r) => r.status === 'late').length;
  const attendance_pct = total_sessions > 0
    ? Math.round((present / total_sessions) * 1000) / 10
    : 0;

  return {
    total_sessions,
    present,
    absent,
    late,
    attendance_pct,
    records,
  };
}

module.exports = {
  createAttendanceSession,
  listSessionsByClass,
  correctRecord,
  getStudentAttendance,
};
