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

async function listAssignmentsBySchedule(scheduleId, classId) {
  const assignments = await db("homework_assignments as a")
    .leftJoin("homework_assignment_content as hac", "hac.assignment_id", "a.id")
    .where({ "a.schedule_id": scheduleId, "a.is_active": true })
    .groupBy("a.id")
    .orderBy("a.assignment_number")
    .select(
      "a.*",
      db.raw("COUNT(hac.content_id)::int as linked_content_count"),
    );

  if (classId && assignments.length > 0) {
    const [{ count: studentCount }] = await db("enrollments")
      .where({ class_id: classId, status: "active", is_active: true })
      .count("* as count");
    const enrolledCount = Number(studentCount || 0);

    const submissionCounts = await db("homework_submissions")
      .where({ class_id: classId, status: "evaluated", is_active: true })
      .whereIn("assignment_id", assignments.map(a => a.id))
      .groupBy("assignment_id")
      .select("assignment_id", db.raw("COUNT(DISTINCT student_id)::int as marked_count"));

    const countMap = new Map(submissionCounts.map(r => [r.assignment_id, Number(r.marked_count)]));
    assignments.forEach(a => {
      const marked = countMap.get(a.id) || 0;
      a.enrolled_count = enrolledCount;
      a.marked_count = marked;
      a.is_fully_marked = enrolledCount > 0 && marked >= enrolledCount;
    });
  }

  return assignments;
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

  const subtopicIds = new Set();
  for (const w of words) {
    if (Array.isArray(w.rule_details)) {
      for (const r of w.rule_details) {
        if (r.subtopic_id) {
          subtopicIds.add(r.subtopic_id);
        }
      }
    }
  }

  const subtopicMap = {};
  if (subtopicIds.size > 0) {
    const subtopics = await db('topic_subtopics')
      .whereIn('id', Array.from(subtopicIds))
      .select('id', 'title');
    for (const st of subtopics) {
      subtopicMap[st.id] = st.title;
    }
  }

  const wordsByContent = {};
  for (const w of words) {
    if (Array.isArray(w.rule_details)) {
      w.rule_details = w.rule_details.map(r => ({
        ...r,
        rule_name: subtopicMap[r.subtopic_id] || r.rule_name || null
      }));
    }

    if (!wordsByContent[w.content_id]) wordsByContent[w.content_id] = [];
    wordsByContent[w.content_id].push(w);
  }

  return contents.map((c) => ({
    ...c,
    words: wordsByContent[c.id] ?? [],
  }));
}

/**
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

/**
 * Bulk-update the due_date on every assignment row for a schedule,
 * computed from firstDueDate + (i * gapDays).
 */
async function applyDueDatesFromFirst({ scheduleId, firstDueDate, frequency, total }) {
  const assignments = await db('homework_assignments')
    .where({ schedule_id: scheduleId, is_active: true })
    .orderBy('assignment_number', 'asc');

  const dueDates = computeDueDates(firstDueDate, frequency, assignments.length);

  return db.transaction(async (trx) => {
    const updated = [];
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const dueDate = dueDates[i] ?? null;
      const [row] = await trx('homework_assignments')
        .where({ id: a.id })
        .update({ due_date: dueDate, updated_at: trx.fn.now() })
        .returning('*');
      updated.push(row);
    }
    return updated;
  });
}


async function getHomeworkGridSheet({ assignmentId, classId }) {
  const assignment = await db('homework_assignments').where({ id: assignmentId }).first();
  if (!assignment) return null;

  const contents = await getAssignmentContent(assignmentId);

  // Compute total max marks based on per-word rules
  let calculatedMaxMarks = 0;
  for (const c of contents) {
    for (const w of c.words || []) {
      const rules = Array.isArray(w.rule_details) ? w.rule_details : [];
      if (rules.length > 0) {
        for (const r of rules) {
          const marks = (r.marks_per_rule ?? 1) * (r.occurrence_count ?? 1);
          calculatedMaxMarks += marks;
        }
      } else {
        // Fallback default 1 mark per word if no specific rules assigned
        calculatedMaxMarks += 1;
      }
    }
  }

  let students = [];
  let marks = [];
  let submissions = [];

  if (classId) {
    students = await db('enrollments as e')
      .join('users as u', 'u.id', 'e.student_user_id')
      .where({ 'e.class_id': classId, 'e.status': 'active', 'e.is_active': true })
      .select('u.id as student_id', 'u.full_name', 'u.full_name_ur')
      .orderBy('u.full_name', 'asc');

    marks = await db('homework_marks')
      .where({ assignment_id: assignmentId, class_id: classId, is_active: true });

    submissions = await db('homework_submissions')
      .where({ assignment_id: assignmentId, class_id: classId, is_active: true });
  }

  return {
    assignment: {
      ...assignment,
      total_marks: calculatedMaxMarks || assignment.total_marks || 0,
    },
    contents,
    students,
    marks,
    submissions,
    calculated_max_marks: calculatedMaxMarks,
  };
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
  updateAssignment,
  applyDueDatesFromFirst,
  getHomeworkGridSheet
};

