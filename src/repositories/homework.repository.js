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


// ── Content Linking ────────────────────────────────────────────────────────────

async function computeAssignmentTotalMarks(assignmentId) {
  const result = await db('homework_assignment_content as hac')
    .join('classwork_content as cc', 'cc.id', 'hac.content_id')
    .where('hac.assignment_id', assignmentId)
    .where('cc.is_active', true)
    .sum('cc.total_marks as sum_marks')
    .first();
  return parseInt(result?.sum_marks ?? 0, 10);
}

async function linkContentToAssignment(assignmentId, contentIds = []) {
  return db.transaction(async (trx) => {
    await trx('homework_assignment_content')
      .where({ assignment_id: assignmentId })
      .delete();

    if (contentIds.length > 0) {
      const rows = contentIds.map((cid, idx) => ({
        assignment_id: assignmentId,
        content_id: cid,
        display_order: idx + 1,
      }));
      await trx('homework_assignment_content').insert(rows);
    }

    const result = await trx('homework_assignment_content as hac')
      .join('classwork_content as cc', 'cc.id', 'hac.content_id')
      .where('hac.assignment_id', assignmentId)
      .where('cc.is_active', true)
      .sum('cc.total_marks as sum_marks')
      .first();
    const totalMarks = parseInt(result?.sum_marks ?? 0, 10);

    const [updated] = await trx('homework_assignments')
      .where({ id: assignmentId })
      .update({ total_marks: totalMarks, updated_at: trx.fn.now() })
      .returning('*');

    return updated;
  });
}

async function getAssignmentContent(assignmentId) {
  const contents = await db('homework_assignment_content as hac')
    .join('classwork_content as cc', 'cc.id', 'hac.content_id')
    .where('hac.assignment_id', assignmentId)
    .where('cc.is_active', true)
    .orderBy('hac.display_order', 'asc')
    .select('cc.*', 'hac.display_order');

  if (contents.length === 0) return [];

  const contentIds = contents.map((c) => c.id);
  const words = await db('classwork_content_words')
    .whereIn('content_id', contentIds)
    .where('is_active', true)
    .orderBy('sequence_order', 'asc');

  const wordsByContent = {};
  for (const w of words) {
    if (!wordsByContent[w.content_id]) wordsByContent[w.content_id] = [];
    wordsByContent[w.content_id].push(w);
  }

  return contents.map((c) => ({
    ...c,
    words: wordsByContent[c.id] ?? [],
  }));
}

/**
 * (Re-)generate assignment rows for a schedule.
 * Deletes all existing rows then inserts fresh ones with recomputed due dates.
 */
async function regenerateAssignments({ scheduleId, courseId, orgId, frequency, totalAssignments, firstDueDate, createdBy }) {
  const dueDates = computeDueDates(firstDueDate, frequency, totalAssignments);

  return db.transaction(async (trx) => {
    await trx('homework_assignments').where({ schedule_id: scheduleId }).delete();

    const rows = dueDates.map((dueDate, idx) => ({
      schedule_id:        scheduleId,
      course_id:          courseId,
      org_id:             orgId,
      assignment_number:  idx + 1,
      title:              `Homework ${idx + 1}`,
      title_ur:           `ہوم ورک ${idx + 1}`,
      due_date:           dueDate,
      topic_ids:          JSON.stringify([]),
      criteria_ids:       JSON.stringify([]),
      is_published:       false,
      created_by:         createdBy,
    }));

    const inserted = await trx('homework_assignments').insert(rows).returning('*');
    return inserted.sort((a, b) => a.assignment_number - b.assignment_number);
  });
}

async function updateAssignment(id, patch) {
  const [row] = await db('homework_assignments')
    .where({ id })
    .update({ ...patch, updated_at: db.fn.now() })
    .returning('*');
  return row;
}
module.exports = {
  getScheduleByCourse,
  createSchedule,
  updateSchedule,
  listAssignmentsBySchedule,
  listAssignmentsByCourse,
  getAssignmentById,
  linkContentToAssignment,
  getAssignmentContent,
  computeAssignmentTotalMarks,
  regenerateAssignments,
  updateAssignment
};
