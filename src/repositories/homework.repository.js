const db = require("../db/knex");

// ── helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function computeDueDates(firstDueDate, frequency, total) {
  const dates = [];
  if (!firstDueDate) {
    for (let i = 0; i < total; i++) dates.push(null);
    return dates;
  }
  const gapDays =
    frequency === "daily"
      ? 1
      : frequency === "after_2_days"
        ? 2
        : frequency === "weekly"
          ? 7
          : frequency === "biweekly"
            ? 14
            : frequency === "monthly"
              ? 30
              : 7; // default weekly
  for (let i = 0; i < total; i++) {
    dates.push(addDays(firstDueDate, i * gapDays));
  }
  return dates;
}

// ── Schedules ─────────────────────────────────────────────────────────────────

async function getScheduleByCourse(courseId) {
  return db("homework_schedules")
    .where({ course_id: courseId, is_active: true })
    .first();
}

async function createSchedule({
  orgId,
  courseId,
  frequency,
  totalAssignments,
  firstDueDate,
  instructions,
  createdBy,
}) {
  const [row] = await db("homework_schedules")
    .insert({
      org_id: orgId,
      course_id: courseId,
      frequency,
      total_assignments: totalAssignments,
      first_due_date: firstDueDate,
      instructions: instructions ?? null,
      created_by: createdBy,
    })
    .returning("*");
  return row;
}

async function updateSchedule(scheduleId, patch) {
  const [row] = await db("homework_schedules")
    .where({ id: scheduleId })
    .update({ ...patch, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

// ── Assignments ───────────────────────────────────────────────────────────────

async function listAssignmentsBySchedule(scheduleId) {
  return db("homework_assignments as a")
    .leftJoin("homework_assignment_content as hac", "hac.assignment_id", "a.id")
    .where({ "a.schedule_id": scheduleId, "a.is_active": true })
    .groupBy("a.id")
    .orderBy("a.assignment_number")
    .select(
      "a.*",
      db.raw("COUNT(hac.content_id)::int as linked_content_count"),
    );
}

async function listAssignmentsByCourse(courseId) {
  return db("homework_assignments as a")
    .join("homework_schedules as s", "s.id", "a.schedule_id")
    .leftJoin("homework_assignment_content as hac", "hac.assignment_id", "a.id")
    .where("a.course_id", courseId)
    .where("a.is_active", true)
    .groupBy("a.id", "s.id")
    .orderBy("a.assignment_number")
    .select(
      "a.*",
      "s.frequency",
      "s.total_assignments",
      db.raw("COUNT(hac.content_id)::int as linked_content_count"),
    );
}

async function getAssignmentById(id) {
  return db("homework_assignments").where({ id }).first();
}

module.exports = {
  getScheduleByCourse,
  createSchedule,
  updateSchedule,
  listAssignmentsBySchedule,
  listAssignmentsByCourse,
  getAssignmentById,
};
