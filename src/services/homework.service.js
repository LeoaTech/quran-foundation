const repo = require('../repositories/homework.repository');
const coursesRepo = require('../repositories/courses.repository');

function notFound(name) {
  const err = new Error(`${name} not found`);
  err.status = 404;
  return err;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

async function getOrCreateSchedule({ courseId, orgId, frequency, totalAssignments, firstDueDate, instructions, userId }) {
  if (!orgId) {
    const course = await coursesRepo.getCourseById(courseId);
    if (!course) throw notFound('Course');
    orgId = course.org_id;
  }

  let schedule = await repo.getScheduleByCourse(courseId);

  if (!schedule) {
    schedule = await repo.createSchedule({
      orgId, courseId, frequency, totalAssignments, firstDueDate, instructions, createdBy: userId,
    });
    // Auto-generate assignment slots
    await repo.regenerateAssignments({
      scheduleId:        schedule.id,
      courseId,
      orgId,
      frequency,
      totalAssignments,
      firstDueDate,
      createdBy:         userId,
    });
  }
  return schedule;
}

async function saveSchedule({ courseId, orgId, frequency, totalAssignments, firstDueDate, instructions, userId }) {
  if (!orgId) {
    const course = await coursesRepo.getCourseById(courseId);
    if (!course) throw notFound('Course');
    orgId = course.org_id;
  }

  let schedule = await repo.getScheduleByCourse(courseId);

  if (schedule) {
    schedule = await repo.updateSchedule(schedule.id, {
      frequency,
      total_assignments: totalAssignments,
      first_due_date:    firstDueDate,
      instructions,
    });
  } else {
    schedule = await repo.createSchedule({
      orgId, courseId, frequency, totalAssignments, firstDueDate, instructions, createdBy: userId,
    });
  }

  // Always regenerate assignments when schedule changes
  const assignments = await repo.regenerateAssignments({
    scheduleId:        schedule.id,
    courseId,
    orgId,
    frequency:         schedule.frequency,
    totalAssignments:  schedule.total_assignments,
    firstDueDate:      schedule.first_due_date,
    createdBy:         userId,
  });

  return { schedule, assignments };
}

async function getScheduleWithAssignments(courseId) {
  const schedule = await repo.getScheduleByCourse(courseId);
  if (!schedule) return null;
  const assignments = await repo.listAssignmentsBySchedule(schedule.id);
  return { schedule, assignments };
}

module.exports = {
  saveSchedule,
  getScheduleWithAssignments
};
