const db = require('../db/knex');

// ── Org overview ──────────────────────────────────────────────────────────────

// Distinct users who hold a 'student' role anywhere.
function countActiveStudents() {
  return db('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .join('users as u', 'u.id', 'ur.user_id')
    .where('r.name', 'student')
    .where('u.is_active', true)
    .countDistinct('ur.user_id as cnt')
    .first();
}

function countActiveTeachers() {
  return db('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .join('users as u', 'u.id', 'ur.user_id')
    .where('r.name', 'teacher')
    .where('u.is_active', true)
    .countDistinct('ur.user_id as cnt')
    .first();
}

function countActiveCenters() {
  return db('centers').where('is_active', true).count('id as cnt').first();
}

// All-time present/total counts across the entire org.
function getOrgAttendanceStats() {
  return db('attendance_records as r')
    .join('attendance_sessions as s', 's.id', 'r.session_id')
    .where('r.is_active', true)
    .where('s.is_active', true)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE r.status = 'present') as present_count"),
    )
    .first();
}

// Active enrollment counts grouped by course name.
function getEnrollmentsByCourse() {
  return db('enrollments as e')
    .join('classes as c', 'c.id', 'e.class_id')
    .join('courses as co', 'co.id', 'c.course_id')
    .where('e.status', 'active')
    .where('e.is_active', true)
    .groupBy('co.id', 'co.name', 'co.name_ur')
    .select(
      'co.name as course',
      'co.name_ur as course_ur',
      db.raw('COUNT(e.id) as count'),
    )
    .orderBy('count', 'desc');
}

// ── Center overview ───────────────────────────────────────────────────────────

function getCenterActiveStudentCount(centerId) {
  return db('enrollments')
    .where({ center_id: centerId, status: 'active', is_active: true })
    .countDistinct('student_user_id as cnt')
    .first();
}

function getCenterActiveTeacherCount(centerId) {
  return db('class_teachers as ct')
    .join('classes as c', 'c.id', 'ct.class_id')
    .where('c.center_id', centerId)
    .where('ct.is_active', true)
    .countDistinct('ct.teacher_user_id as cnt')
    .first();
}

function getCenterClassCount(centerId) {
  return db('classes')
    .where({ center_id: centerId, is_active: true })
    .count('id as cnt')
    .first();
}

// Attendance stats for a center, optionally scoped to a date range.
function getCenterAttendanceStats(centerId, { from, to } = {}) {
  const query = db('attendance_records as r')
    .join('attendance_sessions as s', 's.id', 'r.session_id')
    .where('s.center_id', centerId)
    .where('r.is_active', true)
    .where('s.is_active', true)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE r.status = 'present') as present_count"),
    )
    .first();

  if (from) query.where('s.session_date', '>=', from);
  if (to)   query.where('s.session_date', '<=', to);
  return query;
}

// Count of progress sessions in a center, optionally date-scoped.
function getCenterProgressSessionCount(centerId, { from, to } = {}) {
  const query = db('progress_sessions as ps')
    .join('classes as c', 'c.id', 'ps.class_id')
    .where('c.center_id', centerId)
    .where('ps.is_active', true)
    .count('ps.id as cnt')
    .first();

  if (from) query.where('ps.session_date', '>=', from);
  if (to)   query.where('ps.session_date', '<=', to);
  return query;
}

// ── Student summary ───────────────────────────────────────────────────────────

function getStudentProfile(userId) {
  return db('users')
    .where({ id: userId, is_active: true })
    .select(
      'id',
      'full_name',
      'full_name_ur',
      'display_name_ar',
      'phone',
      'whatsapp',
      'preferred_lang',
    )
    .first();
}

function getStudentAttendanceStats(userId) {
  return db('attendance_records as r')
    .join('attendance_sessions as s', 's.id', 'r.session_id')
    .where('r.student_user_id', userId)
    .where('r.is_active', true)
    .where('s.is_active', true)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE r.status = 'present') as present_count"),
    )
    .first();
}

// Returns [{grade, cnt}] for each non-null classwork grade this student has received.
function getStudentClassworkGrades(userId) {
  return db('progress_sessions as ps')
    .join('enrollments as e', 'e.id', 'ps.enrollment_id')
    .where('e.student_user_id', userId)
    .where('ps.is_active', true)
    .whereNotNull('ps.cw_grade')
    .groupBy('ps.cw_grade')
    .select('ps.cw_grade as grade', db.raw('COUNT(*) as cnt'));
}

// Aggregated homework marks across all sessions — for overall homework_avg_pct.
function getStudentHomeworkStats(userId) {
  return db('homework_scores as hs')
    .join('homework_entries as he', 'he.id', 'hs.homework_entry_id')
    .join('progress_sessions as ps', 'ps.id', 'he.session_id')
    .join('enrollments as e', 'e.id', 'ps.enrollment_id')
    .join('homework_criteria as hc', 'hc.id', 'hs.criteria_id')
    .where('e.student_user_id', userId)
    .where('hs.is_active', true)
    .where('he.is_active', true)
    .where('ps.is_active', true)
    .select(
      db.raw('SUM(hs.marks_obtained) as total_obtained'),
      db.raw('SUM(hc.max_marks) as total_max'),
    )
    .first();
}

// Unique topics covered in classwork across all sessions for this student.
function getStudentTopicsCovered(userId) {
  return db('progress_sessions as ps')
    .join('enrollments as e', 'e.id', 'ps.enrollment_id')
    .join('topics as t', 't.id', 'ps.cw_topic_id')
    .where('e.student_user_id', userId)
    .where('ps.is_active', true)
    .whereNotNull('ps.cw_topic_id')
    .distinct('t.id', 't.title', 't.title_ur', 't.title_ar')
    .orderBy('t.title', 'asc');
}

// All assessment results for this student, with assessment metadata.
function getStudentAssessmentScores(userId) {
  return db('assessment_results as ar')
    .join('assessments as a', 'a.id', 'ar.assessment_id')
    .where('ar.student_user_id', userId)
    .where('ar.is_active', true)
    .where('a.is_active', true)
    .select(
      'a.id as assessment_id',
      'a.title',
      'a.title_ur',
      'a.type',
      'a.assessment_date',
      'a.max_score',
      'ar.score',
      'ar.oral_grade',
      'ar.remarks_ur',
    )
    .orderBy('a.assessment_date', 'desc');
}

// ── Homework performance by class ─────────────────────────────────────────────

// Per-criterion aggregates (avg, min, max) for all homework in a class,
// optionally scoped to a session date range.
function getHomeworkPerformanceByClass(classId, { from, to } = {}) {
  const query = db('homework_scores as hs')
    .join('homework_criteria as hc', 'hc.id', 'hs.criteria_id')
    .join('homework_entries as he', 'he.id', 'hs.homework_entry_id')
    .join('progress_sessions as ps', 'ps.id', 'he.session_id')
    .where('ps.class_id', classId)
    .where('hs.is_active', true)
    .where('he.is_active', true)
    .where('ps.is_active', true)
    .groupBy(
      'hc.id',
      'hc.label',
      'hc.label_ur',
      'hc.max_marks',
      'hc.display_order',
    )
    .select(
      'hc.id as criteria_id',
      'hc.label',
      'hc.label_ur',
      'hc.max_marks',
      db.raw('ROUND(AVG(hs.marks_obtained)::numeric, 1) as class_avg'),
      db.raw('MIN(hs.marks_obtained) as lowest'),
      db.raw('MAX(hs.marks_obtained) as highest'),
      db.raw('COUNT(hs.id) as submission_count'),
    )
    .orderBy('hc.display_order', 'asc');

  if (from) query.where('ps.session_date', '>=', from);
  if (to)   query.where('ps.session_date', '<=', to);
  return query;
}

module.exports = {
  // Org
  countActiveStudents,
  countActiveTeachers,
  countActiveCenters,
  getOrgAttendanceStats,
  getEnrollmentsByCourse,
  // Center
  getCenterActiveStudentCount,
  getCenterActiveTeacherCount,
  getCenterClassCount,
  getCenterAttendanceStats,
  getCenterProgressSessionCount,
  // Student
  getStudentProfile,
  getStudentAttendanceStats,
  getStudentClassworkGrades,
  getStudentHomeworkStats,
  getStudentTopicsCovered,
  getStudentAssessmentScores,
  // Class
  getHomeworkPerformanceByClass,
};
