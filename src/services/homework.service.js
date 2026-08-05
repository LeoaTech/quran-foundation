const repo = require("../repositories/homework.repository");
const coursesRepo = require("../repositories/courses.repository");

function notFound(name) {
  const err = new Error(`${name} not found`);
  err.status = 404;
  return err;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

async function getOrCreateSchedule({
  courseId,
  orgId,
  frequency,
  totalAssignments,
  firstDueDate,
  instructions,
  userId,
}) {
  if (!orgId) {
    const course = await coursesRepo.getCourseById(courseId);
    if (!course) throw notFound("Course");
    orgId = course.org_id;
  }

  let schedule = await repo.getScheduleByCourse(courseId);

  if (!schedule) {
    schedule = await repo.createSchedule({
      orgId,
      courseId,
      frequency,
      totalAssignments,
      firstDueDate,
      instructions,
      createdBy: userId,
    });
    // Auto-generate assignment slots
    await repo.regenerateAssignments({
      scheduleId: schedule.id,
      courseId,
      orgId,
      frequency,
      totalAssignments,
      firstDueDate,
      createdBy: userId,
    });
  }
  return schedule;
}

async function saveSchedule({
  courseId,
  orgId,
  frequency,
  totalAssignments,
  firstDueDate,
  instructions,
  userId,
}) {
  if (!orgId) {
    const course = await coursesRepo.getCourseById(courseId);
    if (!course) throw notFound("Course");
    orgId = course.org_id;
  }

  let schedule = await repo.getScheduleByCourse(courseId);

  if (schedule) {
    schedule = await repo.updateSchedule(schedule.id, {
      frequency,
      total_assignments: totalAssignments,
      first_due_date: firstDueDate,
      instructions,
    });
  } else {
    schedule = await repo.createSchedule({
      orgId,
      courseId,
      frequency,
      totalAssignments,
      firstDueDate,
      instructions,
      createdBy: userId,
    });
  }

  // Always regenerate assignments when schedule changes
  const assignments = await repo.regenerateAssignments({
    scheduleId: schedule.id,
    courseId,
    orgId,
    frequency: schedule.frequency,
    totalAssignments: schedule.total_assignments,
    firstDueDate: schedule.first_due_date,
    createdBy: userId,
  });

  return { schedule, assignments };
}

async function getScheduleWithAssignments(courseId, classId) {
  const schedule = await repo.getScheduleByCourse(courseId);
  if (!schedule) return null;
  const assignments = await repo.listAssignmentsBySchedule(schedule.id, classId);
  return { schedule, assignments };
}

// ── Individual Assignment ─────────────────────────────────────────────────────

async function updateAssignment(id, patch, userId) {
  const existing = await repo.getAssignmentById(id);
  if (!existing) throw notFound("Homework Assignment");
  // Allow center managers to patch individual due_date
  const allowedPatch = {};
  const allowedFields = ['title', 'title_ur', 'instructions', 'topic_ids', 'criteria_ids', 'is_published', 'due_date'];
  for (const key of allowedFields) {
    if (key in patch) allowedPatch[key] = patch[key];
  }
  return repo.updateAssignment(id, allowedPatch);
}

/**
 * Center manager applies a first-assignment due date and auto-calculates
 * all subsequent due dates using the admin's configured frequency.
 * Does NOT wipe or recreate assignments — only updates due_date fields.
 */
async function applyScheduleDates({ courseId, firstDueDate }) {
  const schedule = await repo.getScheduleByCourse(courseId);
  if (!schedule) throw notFound('Homework Schedule');
  const assignments = await repo.applyDueDatesFromFirst({
    scheduleId: schedule.id,
    firstDueDate,
    frequency: schedule.frequency,
    total: schedule.total_assignments,
  });
  return { schedule, assignments };
}

// ── Content Linking ────────────────────────────────────────────────────────────

async function getAssignmentContent(assignmentId) {
  const existing = await repo.getAssignmentById(assignmentId);
  if (!existing) throw notFound("Homework Assignment");
  return repo.getAssignmentContent(assignmentId);
}

async function linkContentToAssignment(assignmentId, contentIds) {
  const existing = await repo.getAssignmentById(assignmentId);
  if (!existing) throw notFound("Homework Assignment");
  return repo.linkContentToAssignment(assignmentId, contentIds);
}

async function getHomeworkGridSheet({ assignmentId, classId }) {
  const existing = await repo.getAssignmentById(assignmentId);
  if (!existing) throw notFound("Homework Assignment");
  return repo.getHomeworkGridSheet({ assignmentId, classId });
}

async function saveHomeworkGridMarks({ user, assignmentId, classId, body }) {
  const existing = await repo.getAssignmentById(assignmentId);
  if (!existing) throw notFound("Homework Assignment");

  const userRoles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  const isTeacher = userRoles.includes('teacher') || user?.role === 'teacher';

  if (!isTeacher) {
    const err = new Error("Center Managers cannot enter or edit homework marks. Marking is restricted to classroom teachers.");
    err.status = 403;
    throw err;
  }

  if (classId) {
    const gridData = await repo.getHomeworkGridSheet({ assignmentId, classId });
    if (gridData && gridData.is_fully_marked && gridData.evaluator_teacher_id) {
      const isEvaluator = gridData.evaluator_teacher_id === user.id;

      if (!isEvaluator) {
        const teacherName = gridData.evaluator_teacher_name || 'another teacher';
        const err = new Error(`This homework assignment has already been evaluated and completed by Teacher ${teacherName}. Editing is restricted to ${teacherName}.`);
        err.status = 403;
        throw err;
      }
    }
  }

  const marks = Array.isArray(body?.marks) ? body.marks : [];
  const studentNotes = body?.studentNotes || {};
  return repo.bulkUpsertHomeworkMarks({ assignmentId, classId, marks, studentNotes, userId: user.id });
}

module.exports = {
  saveSchedule,
  getScheduleWithAssignments,
  updateAssignment,
  applyScheduleDates,
  getAssignmentContent,
  linkContentToAssignment,
  getHomeworkGridSheet,
  saveHomeworkGridMarks,
};

