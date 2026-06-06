const repo      = require('../repositories/classes.repository');
const centerRepo = require('../repositories/centers.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');

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
  if (user.center_id !== centerId) throw forbidden();
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
    if (user.center_id !== cls.center_id) throw forbidden();
    return;
  }

  if (user.roles.includes('teacher')) {
    const entry = await repo.getClassTeacherEntry(cls.id, user.id);
    if (!entry) throw forbidden();
    return;
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
};
