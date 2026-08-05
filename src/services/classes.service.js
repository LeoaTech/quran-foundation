const repo      = require('../repositories/classes.repository');
const centerRepo = require('../repositories/centers.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');
const enrollmentsRepo = require('../repositories/enrollments.repository');
const attendanceRepo = require('../repositories/attendance.repository');
const homeworkRepo = require('../repositories/homework.repository');
const classworkRepo = require('../repositories/classwork.repository');

const DAY_ALIASES = {
  sun: 'Sunday', sunday: 'Sunday',
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
};

function normalizeDayInput(day) {
  const key = day.trim().toLowerCase();
  return DAY_ALIASES[key] || (day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function notFound(entity = 'Class') {
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

// Throws 403 if a non-super_admin is accessing a center they are not scoped to.
function assertCenterAccess(user, centerId) {
  if (user.roles.includes('super_admin')) return;
  if (String(user.center_id) !== String(centerId)) throw forbidden();
}

// Resolves & returns the class, throwing 404 if missing.
async function requireClass(classId) {
  const cls = await repo.getClassById(classId);
  if (!cls) throw notFound('Class');
  return cls;
}

// For class-level operations: center_managers must own the center; teachers must
// be assigned to the class via class_teachers.
async function assertClassAccess(user, cls) {
  if (user.roles.includes('super_admin')) return;

  if (user.roles.includes('center_manager')) {
    if (String(user.center_id) !== String(cls.center_id)) throw forbidden();
    return;
  }

  if (user.roles.includes('teacher')) {
    const entry = await repo.getClassTeacherEntry(cls.id, user.id);
    if (entry) return;
    
    const hasTopicAccess = await repo.hasTeacherTopicAccess(cls.center_id, cls.course_id, user.id);
    if (hasTopicAccess) return;

    throw forbidden();
  }

  throw forbidden();
}

// ── Classes ────────────────────────────────────────────────────────────────────

async function listClasses({ user, centerId, query = {} }) {
  assertCenterAccess(user, centerId);

  const center = await centerRepo.getCenterById(centerId);
  if (!center) throw notFound('Center');

  const filters = {
    courseId: query.course_id,
    isActive: query.is_active !== undefined ? query.is_active === 'true' : undefined,
  };

  // Teachers only see their own classes; managers see all.
  if (user.roles.includes('teacher') && !user.roles.includes('center_manager') && !user.roles.includes('super_admin')) {
    return repo.listClassesForTeacher(centerId, user.id, filters);
  }

  return repo.listClasses(centerId, filters);
}

async function getClass({ user, classId }) {
  const cls = await requireClass(classId);
  await assertClassAccess(user, cls);
  return cls;
}

async function createClass({ user, centerId, body }) {
  assertCenterAccess(user, centerId);

  const center = await centerRepo.getCenterById(centerId);
  if (!center || !center.is_active) {
    throw new AppError('NOT_FOUND', 'Center not found or inactive.', 'مرکز نہیں ملا یا غیر فعال ہے۔', 404);
  }

  const cls = await repo.createClass({
    center_id: centerId,
    course_id: body.course_id,
    course_level_id: body.course_level_id || null,
    name: body.name,
    name_ur: body.name_ur || null,
    max_capacity: body.max_capacity,
    schedule_days: body.schedule_days || '',
    start_time: body.start_time || null,
    start_date: body.start_date || null,
  });

  // Automatically populate class_schedules
  if (body.schedule_days && body.start_time) {
    const days = body.schedule_days.split(',').map(d => d.trim()).filter(Boolean);
    for (const day of days) {
      const capitalizedDay = normalizeDayInput(day);
      let endTime = null;
      try {
        const [hours, minutes] = body.start_time.split(':');
        const startHrs = parseInt(hours, 10);
        const endHrs = (startHrs + 3) % 24;
        endTime = `${String(endHrs).padStart(2, '0')}:${minutes || '00'}:00`;
      } catch (e) {}

      await repo.createSchedule({
        class_id: cls.id,
        day_of_week: capitalizedDay,
        start_time: body.start_time,
        end_time: endTime,
      });
    }
  }

  activityLog.log({
    actor:       user,
    action:      'class.create',
    entity_type: 'class',
    entity_id:   cls.id,
    center_id:   centerId,
    org_id:      center.org_id,
    summary_en:  `Created class "${cls.name}" at center "${center.name}"`,
    metadata:    { class_name: cls.name, center_name: center.name },
  }).catch(() => {});
  return cls;
}

async function updateClass({ user, classId, body }) {
  const cls = await requireClass(classId);
  await assertClassAccess(user, cls);
  const updated = await repo.updateClass(classId, body);
  activityLog.log({
    actor:       user,
    action:      'class.update',
    entity_type: 'class',
    entity_id:   classId,
    center_id:   cls.center_id,
    summary_en:  `Updated class "${updated.name || cls.name}"`,
    metadata:    { class_name: updated.name || cls.name },
  }).catch(() => {});
  return updated;
}

// ── Class Teachers ─────────────────────────────────────────────────────────────

async function listTeachers({ user, classId }) {
  const cls = await requireClass(classId);
  await assertClassAccess(user, cls);
  return repo.listTeachers(classId);
}

async function assignTeacher({ user, classId, body }) {
  const cls = await requireClass(classId);

  // Only managers (and super_admin) may assign teachers.
  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    throw forbidden();
  }
  assertCenterAccess(user, cls.center_id);

  // Check for duplicate active assignment.
  const existing = await repo.getClassTeacherEntry(classId, body.teacher_user_id);
  if (existing) {
    throw new AppError(
      'CONFLICT',
      'Teacher is already assigned to this class.',
      'یہ استاد پہلے سے اس کلاس میں تفویض ہے۔',
      409,
    );
  }

  return repo.assignTeacher({
    class_id:        classId,
    teacher_user_id: body.teacher_user_id,
    is_primary:      body.is_primary || false,
    assigned_from:   body.assigned_from || null,
    is_active:       true,
  });
}

async function removeTeacher({ user, classId, classTeacherId }) {
  const cls = await requireClass(classId);

  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    throw forbidden();
  }
  assertCenterAccess(user, cls.center_id);

  const entry = await repo.getClassTeacherById(classTeacherId);
  if (!entry || entry.class_id !== classId) throw notFound('Teacher assignment');

  return repo.deactivateTeacher(classTeacherId);
}

// ── Homework Criteria ──────────────────────────────────────────────────────────

async function listCriteria({ user, classId }) {
  const cls = await requireClass(classId);
  await assertClassAccess(user, cls);
  return repo.listCriteria(classId);
}

async function createCriteria({ user, classId, body }) {
  const cls = await requireClass(classId);

  // Must be a manager or a teacher assigned to this class.
  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    const entry = await repo.getClassTeacherEntry(classId, user.id);
    if (!entry) throw forbidden();
  } else {
    assertCenterAccess(user, cls.center_id);
  }

  return repo.createCriteria({ ...body, class_id: classId });
}

async function updateCriteria({ user, classId, criteriaId, body }) {
  const cls = await requireClass(classId);

  const criterion = await repo.getCriteriaById(criteriaId);
  if (!criterion || criterion.class_id !== classId) throw notFound('Homework criterion');

  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    const entry = await repo.getClassTeacherEntry(classId, user.id);
    if (!entry) throw forbidden();
  } else {
    assertCenterAccess(user, cls.center_id);
  }

  return repo.updateCriteria(criteriaId, body);
}

async function deleteCriteria({ user, classId, criteriaId }) {
  const cls = await requireClass(classId);

  const criterion = await repo.getCriteriaById(criteriaId);
  if (!criterion || criterion.class_id !== classId) throw notFound('Homework criterion');

  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    const entry = await repo.getClassTeacherEntry(classId, user.id);
    if (!entry) throw forbidden();
  } else {
    assertCenterAccess(user, cls.center_id);
  }

  // NEVER hard-delete — historical homework_scores must remain intact.
  return repo.deactivateCriteria(criteriaId);
}

// ── Class Schedules ───────────────────────────────────────────────────────────

async function listSchedules({ user, classId }) {
  const cls = await requireClass(classId);
  await assertClassAccess(user, cls);
  return repo.listSchedules(classId);
}

async function createSchedule({ user, classId, body }) {
  const cls = await requireClass(classId);
  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    throw forbidden();
  }
  assertCenterAccess(user, cls.center_id);
  return repo.createSchedule({
    class_id: classId,
    day_of_week: body.day_of_week,
    start_time: body.start_time,
    end_time: body.end_time || null,
    is_active: true,
  });
}

async function deleteSchedule({ user, classId, scheduleId }) {
  const cls = await requireClass(classId);
  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager')) {
    throw forbidden();
  }
  assertCenterAccess(user, cls.center_id);
  const schedule = await repo.getScheduleById(scheduleId);
  if (!schedule || schedule.class_id !== classId) throw notFound('Schedule slot');
  return repo.deactivateSchedule(scheduleId);
}

// ── Class Session Plans ───────────────────────────────────────────────────────

async function listSessionPlans({ user, classId }) {
  const cls = await requireClass(classId);
  await assertClassAccess(user, cls);
  return repo.listSessionPlans(classId);
}

async function upsertSessionPlan({ user, classId, body }) {
  const cls = await requireClass(classId);
  if (!user.roles.includes('super_admin') && !user.roles.includes('center_manager') && !user.roles.includes('teacher')) {
    throw forbidden();
  }
  assertCenterAccess(user, cls.center_id);
  return repo.upsertSessionPlan(classId, body);
}

// ── Student Portal Helper ──────────────────────────────────────────────────────

function safeISOFormatDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function addDaysStr(dateStr, days) {
  const clean = safeISOFormatDate(dateStr);
  if (!clean) return null;
  const d = new Date(clean + "T00:00:00Z");
  if (isNaN(d.getTime())) return clean;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function getFrequencyGapDays(frequency) {
  switch (frequency) {
    case 'daily': return 1;
    case 'after_2_days': return 2;
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30;
    default: return 7;
  }
}

function computeStudentHomeworkAssignments(assignments, schedule, submissions, todayStr) {
  const gapDays = getFrequencyGapDays(schedule?.frequency);
  const subMap = new Map((submissions || []).map(s => [s.assignment_id, s]));

  //  Calculate status for all assignments sequentially
  const processed = (assignments || []).map((a, i) => {
    const dueDate = safeISOFormatDate(a.due_date);
    let status = 'Upcoming';

    if (dueDate) {
      let startDate;
      const prevDueDate = i > 0 ? safeISOFormatDate(assignments[i - 1]?.due_date) : null;
      if (prevDueDate) {
        startDate = addDaysStr(prevDueDate, 1);
      } else {
        startDate = addDaysStr(dueDate, -(gapDays - 1));
      }
      const endDate = dueDate;

      if (todayStr > endDate) {
        status = 'Past';
      } else if (todayStr >= startDate && todayStr <= endDate) {
        status = 'Active';
      } else {
        status = 'Upcoming';
      }
    }

    const sub = subMap.get(a.id);
    let grading_status = 'Not marked';
    let marks_awarded = null;
    let max_marks = a.total_marks || 0;
    let teacher_note = null;

    if (sub) {
      if (sub.status === 'evaluated') {
        grading_status = 'Marked';
      } else if (sub.status === 'in_progress') {
        grading_status = 'In-progress';
      } else {
        grading_status = 'Not marked';
      }
      marks_awarded = sub.marks_awarded !== undefined && sub.marks_awarded !== null ? Number(sub.marks_awarded) : null;
      if (sub.max_marks) max_marks = Number(sub.max_marks);
      teacher_note = sub.teacher_note || null;
    }

    return {
      ...a,
      status,
      grading_status,
      marks_awarded,
      max_marks,
      teacher_note,
      is_accessible: status === 'Active' || status === 'Past'
    };
  });

  //  Filter out unpublished & upcoming assignments for students
  const visibleToStudent = processed.filter(a => {
    const isPublished = a.is_published === true || a.is_published === 1;
    const isAccessible = a.status === 'Active' || a.status === 'Past';
    return isPublished && isAccessible;
  });

  // Sort New to Old (Active on top, then newest due dates/assignment numbers)
  visibleToStudent.sort((a, b) => {
    if (a.status === 'Active' && b.status !== 'Active') return -1;
    if (b.status === 'Active' && a.status !== 'Active') return 1;

    const numA = Number(a.assignment_number || 0);
    const numB = Number(b.assignment_number || 0);
    if (numA !== numB) return numB - numA;

    const dateA = safeISOFormatDate(a.due_date) || '';
    const dateB = safeISOFormatDate(b.due_date) || '';
    return dateB.localeCompare(dateA);
  });

  return visibleToStudent;
}

// ── Student Portal ────────────────────────────────────────────────────────────

async function getStudentClassDetail({ user, classId }) {
  // Check if student is actively enrolled (if role is student)
  if (user.role === 'student') {
    const enrollment = await enrollmentsRepo.getActiveEnrollmentForStudent(classId, user.id);
    if (!enrollment) {
      throw forbidden();
    }
  }

  const cls = await requireClass(classId);
  const classTeachers = await repo.listTeachers(classId);
  const topicTeachers = await repo.listAssignedTopicTeachers(cls.center_id, cls.course_id);
  
  // Merge teachers (deduplicate by user id)
  const teachersMap = new Map();
  classTeachers.forEach(t => teachersMap.set(t.teacher_user_id, { ...t, topics_assigned: [] }));
  topicTeachers.forEach(t => {
    if (teachersMap.has(t.teacher_user_id)) {
      teachersMap.get(t.teacher_user_id).topics_assigned = t.topics_assigned;
    } else {
      teachersMap.set(t.teacher_user_id, {
        class_teacher_id: null,
        is_primary: false,
        assigned_from: null,
        teacher_user_id: t.teacher_user_id,
        full_name: t.full_name,
        full_name_ur: t.full_name_ur,
        phone: t.phone,
        topics_assigned: t.topics_assigned
      });
    }
  });
  const teachers = Array.from(teachersMap.values());

  const sessionPlans = await repo.listSessionPlans(classId);
  const attendanceRecords = await attendanceRepo.getStudentAttendanceRecords(user.id, { classId });

  // Map attendance records by normalized session_date for easy lookup on frontend
  const attendanceMap = {};
  attendanceRecords.forEach(r => {
    const dKey = safeISOFormatDate(r.session_date);
    if (dKey) attendanceMap[dKey] = r;
  });

  // Fetch Classwork Sheet Entries for Student (fail-safe)
  let classworkEntries = [];
  try {
    classworkEntries = await classworkRepo.getClassworkEntriesForStudentInClass(classId, user.id);
  } catch (err) {
    console.error('Error fetching student classwork sheet entries:', err);
    classworkEntries = [];
  }
  const classworkMapBySessionId = new Map();
  const classworkMapByDate = new Map();
  (classworkEntries || []).forEach(entry => {
    if (entry.class_session_id) {
      classworkMapBySessionId.set(entry.class_session_id, entry);
    }
    const dKey = safeISOFormatDate(entry.session_date);
    if (dKey) {
      classworkMapByDate.set(dKey, entry);
    }
  });

  const todayStr = safeISOFormatDate(new Date());

  // Filter session plans up to today's date for student view
  const filteredSessionPlans = sessionPlans.filter(sp => {
    const dKey = safeISOFormatDate(sp.session_date);
    return !dKey || dKey <= todayStr;
  });

  // Attach attendance & classwork evaluations to session plans
  const mappedSessionPlans = filteredSessionPlans.map(sp => {
    const dKey = safeISOFormatDate(sp.session_date);
    const cw = classworkMapBySessionId.get(sp.id) || (dKey ? classworkMapByDate.get(dKey) : null) || null;
    const att = dKey ? attendanceMap[dKey] : null;
    return {
      ...sp,
      attendance: att,
      classwork: cw ? {
        id: cw.id,
        topic_id: cw.topic_id,
        topic_title: cw.topic_title || sp.topic_title || sp.syllabus_topic_title || null,
        topic_title_ur: cw.topic_title_ur || sp.topic_title_ur || sp.syllabus_topic_title_ur || null,
        subtopic_id: cw.subtopic_id,
        subtopic_title: cw.subtopic_title,
        subtopic_title_ur: cw.subtopic_title_ur,
        grade: cw.grade,
        comments: cw.comments,
        teacher_name: cw.teacher_name || null,
        teacher_name_ur: cw.teacher_name_ur || null,
        updated_at: cw.updated_at
      } : null
    };
  });

  // Sort session plans from NEW to OLD (descending session_date)
  mappedSessionPlans.sort((a, b) => {
    const dateA = safeISOFormatDate(a.session_date) || '';
    const dateB = safeISOFormatDate(b.session_date) || '';
    return dateB.localeCompare(dateA);
  });

  // Calculate Classwork Summary stats (supporting numeric 0-10 and category strings)
  const classworkSummary = {
    totalEvaluated: 0,
    excellent: 0,
    good: 0,
    average: 0,
    revision: 0
  };
  mappedSessionPlans.forEach(sp => {
    if (sp.classwork?.grade != null && sp.classwork.grade !== '') {
      classworkSummary.totalEvaluated++;
      const gStr = String(sp.classwork.grade).toLowerCase();
      const num = parseFloat(gStr);
      if (!isNaN(num)) {
        if (num >= 9) classworkSummary.excellent++;
        else if (num >= 7) classworkSummary.good++;
        else if (num >= 5) classworkSummary.average++;
        else classworkSummary.revision++;
      } else {
        if (gStr === 'excellent') classworkSummary.excellent++;
        else if (gStr === 'good' || gStr === 'very good') classworkSummary.good++;
        else if (gStr === 'average') classworkSummary.average++;
        else if (gStr === 'revision' || gStr === 'practice') classworkSummary.revision++;
      }
    }
  });

  // Fetch Homework Assignments for Student (fail-safe)
  let homeworkAssignments = [];
  try {
    const schedule = await homeworkRepo.getScheduleByCourse(cls.course_id);
    if (schedule) {
      const rawAssignments = await homeworkRepo.listAssignmentsBySchedule(schedule.id, classId);
      const submissions = await homeworkRepo.listSubmissionsForStudentInClass(classId, user.id);
      const todayStr = safeISOFormatDate(new Date());
      homeworkAssignments = computeStudentHomeworkAssignments(rawAssignments, schedule, submissions, todayStr);
    }
  } catch (err) {
    console.error('Error fetching student homework assignments:', err);
    homeworkAssignments = [];
  }

  return {
    class: cls,
    teachers,
    sessionPlans: mappedSessionPlans,
    homeworkAssignments,
    classworkSummary,
    attendanceSummary: {
      total: attendanceRecords.length,
      present: attendanceRecords.filter(r => r.status === 'present').length,
      absent: attendanceRecords.filter(r => r.status === 'absent').length,
      late: attendanceRecords.filter(r => r.status === 'late').length
    }
  };
}

module.exports = {
  listClasses,
  getClass,
  createClass,
  updateClass,
  listTeachers,
  assignTeacher,
  removeTeacher,
  listCriteria,
  createCriteria,
  updateCriteria,
  deleteCriteria,
  listSchedules,
  createSchedule,
  deleteSchedule,
  listSessionPlans,
  upsertSessionPlan,
  getStudentClassDetail,
};
