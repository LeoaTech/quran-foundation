const repo         = require('../repositories/reports.repository');
const classRepo    = require('../repositories/classes.repository');
const centersRepo  = require('../repositories/centers.repository');
const cache        = require('../utils/reportCache');
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

function assertCenterAccess(user, centerId) {
  if (user.roles.includes('super_admin')) return;
  if (user.center_id !== centerId) throw forbidden();
}

// Parse "YYYY-MM" → { from: "YYYY-MM-01", to: "YYYY-MM-DD" (last day) }
function parseMonth(month) {
  if (!month) return { from: null, to: null };
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this
  return {
    from: `${month}-01`,
    to:   `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function toInt(val) {
  return parseInt(val, 10) || 0;
}

// ── GET /reports/org/overview ─────────────────────────────────────────────────

async function getOrgOverview() {
  const cacheKey = cache.keys.orgOverview();
  const hit = await cache.getCached(cacheKey);
  if (hit) return hit;

  const [students, teachers, centerCount, attendanceStats, enrollmentsByCourse] = await Promise.all([
    repo.countActiveStudents(),
    repo.countActiveTeachers(),
    repo.countActiveCenters(),
    repo.getOrgAttendanceStats(),
    repo.getEnrollmentsByCourse(),
  ]);

  const total   = toInt(attendanceStats.total);
  const present = toInt(attendanceStats.present_count);
  const avg_attendance_pct = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const result = {
    total_students:         toInt(students.cnt),
    total_teachers:         toInt(teachers.cnt),
    active_centers:         toInt(centerCount.cnt),
    avg_attendance_pct,
    enrollments_by_course:  enrollmentsByCourse.map((r) => ({
      course:    r.course,
      course_ur: r.course_ur,
      count:     toInt(r.count),
    })),
  };

  await cache.setCached(cacheKey, result, cache.TTL.ORG_OVERVIEW);
  return result;
}

// ── GET /reports/centers/:center_id/overview ─────────────────────────────────

async function getCenterOverview({ user, centerId, query = {} }) {
  const center = await centersRepo.getCenterById(centerId);
  if (!center || !center.is_active) throw notFound('Center');
  assertCenterAccess(user, centerId);

  const month = query.month || null;
  const cacheKey = cache.keys.centerOverview(centerId, month);
  const hit = await cache.getCached(cacheKey);
  if (hit) return hit;

  const { from, to } = parseMonth(month);

  const [studentCount, teacherCount, classCount, attendanceStats, progressCount] = await Promise.all([
    repo.getCenterActiveStudentCount(centerId),
    repo.getCenterActiveTeacherCount(centerId),
    repo.getCenterClassCount(centerId),
    repo.getCenterAttendanceStats(centerId, { from, to }),
    repo.getCenterProgressSessionCount(centerId, { from, to }),
  ]);

  const total   = toInt(attendanceStats.total);
  const present = toInt(attendanceStats.present_count);
  const attendance_pct = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const result = {
    active_students:            toInt(studentCount.cnt),
    active_teachers:            toInt(teacherCount.cnt),
    active_classes:             toInt(classCount.cnt),
    attendance_pct,
    total_attendance_records:   total,
    progress_sessions:          toInt(progressCount.cnt),
    period: month ? { month, from, to } : { all_time: true },
  };

  await cache.setCached(cacheKey, result, cache.TTL.CENTER_OVERVIEW);
  return result;
}

// ── GET /reports/students/:user_id/summary ────────────────────────────────────

async function getStudentSummary({ studentUserId }) {
  const cacheKey = cache.keys.studentSummary(studentUserId);
  const hit = await cache.getCached(cacheKey);
  if (hit) return hit;

  const [student, attendanceStats, classworkRows, homeworkStats, topicRows, assessmentRows] =
    await Promise.all([
      repo.getStudentProfile(studentUserId),
      repo.getStudentAttendanceStats(studentUserId),
      repo.getStudentClassworkGrades(studentUserId),
      repo.getStudentHomeworkStats(studentUserId),
      repo.getStudentTopicsCovered(studentUserId),
      repo.getStudentAssessmentScores(studentUserId),
    ]);

  if (!student) throw notFound('Student');

  // Attendance pct
  const totalSessions = toInt(attendanceStats.total);
  const present       = toInt(attendanceStats.present_count);
  const attendance_pct = totalSessions > 0
    ? Math.round((present / totalSessions) * 1000) / 10
    : 0;

  // Classwork grade breakdown — all four grades always present in the response.
  const classwork_grades = { excellent: 0, good: 0, average: 0, revision: 0 };
  for (const row of classworkRows) {
    if (row.grade in classwork_grades) {
      classwork_grades[row.grade] = toInt(row.cnt);
    }
  }

  // Homework average pct (overall obtained / overall max)
  const totalObtained = parseFloat(homeworkStats.total_obtained) || 0;
  const totalMax      = parseFloat(homeworkStats.total_max)      || 0;
  const homework_avg_pct = totalMax > 0
    ? Math.round((totalObtained / totalMax) * 1000) / 10
    : 0;

  const result = {
    student,
    attendance_pct,
    classwork_grades,
    homework_avg_pct,
    topics_covered:   topicRows,
    assessment_scores: assessmentRows,
  };

  await cache.setCached(cacheKey, result, cache.TTL.STUDENT_SUMMARY);
  return result;
}

// ── GET /reports/classes/:class_id/homework-performance ──────────────────────

async function getHomeworkPerformance({ user, classId, query = {} }) {
  const cls = await classRepo.getClassById(classId);
  if (!cls || !cls.is_active) throw notFound('Class');
  assertCenterAccess(user, cls.center_id);

  const { from, to } = query;
  const rows = await repo.getHomeworkPerformanceByClass(classId, { from, to });

  return {
    criteria: rows.map((r) => ({
      criteria_id:       r.criteria_id,
      label:             r.label,
      label_ur:          r.label_ur,
      max_marks:         r.max_marks,
      class_avg:         parseFloat(r.class_avg) || 0,
      lowest:            r.lowest  !== null ? toInt(r.lowest)  : null,
      highest:           r.highest !== null ? toInt(r.highest) : null,
      submission_count:  toInt(r.submission_count),
    })),
  };
}

module.exports = {
  getOrgOverview,
  getCenterOverview,
  getStudentSummary,
  getHomeworkPerformance,
};
