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

    const submissionCounts = await db("homework_submissions as hs")
      .leftJoin("users as u", "u.id", "hs.marked_by")
      .where({ "hs.class_id": classId, "hs.status": "evaluated", "hs.is_active": true })
      .whereIn("hs.assignment_id", assignments.map(a => a.id))
      .groupBy("hs.assignment_id", "hs.marked_by", "u.full_name", "u.full_name_ur")
      .select("hs.assignment_id", "hs.marked_by", "u.full_name as marked_by_name", "u.full_name_ur as marked_by_name_ur", db.raw("COUNT(DISTINCT hs.student_id)::int as marked_count"));

    const inProgressCounts = await db("homework_submissions")
      .where({ class_id: classId, is_active: true })
      .whereIn("status", ["evaluated", "in_progress"])
      .whereIn("assignment_id", assignments.map(a => a.id))
      .groupBy("assignment_id")
      .select("assignment_id", db.raw("COUNT(DISTINCT student_id)::int as any_marked_count"));

    const countMap = new Map();
    const teacherMap = new Map();
    submissionCounts.forEach(r => {
      countMap.set(r.assignment_id, (countMap.get(r.assignment_id) || 0) + Number(r.marked_count));
      if (r.marked_by_name) {
        teacherMap.set(r.assignment_id, { id: r.marked_by, name: r.marked_by_name, name_ur: r.marked_by_name_ur });
      }
    });

    const inProgressMap = new Map(inProgressCounts.map(r => [r.assignment_id, Number(r.any_marked_count)]));
    assignments.forEach(a => {
      const fullyMarked = countMap.get(a.id) || 0;
      const anyMarked = inProgressMap.get(a.id) || 0;
      const teacherInfo = teacherMap.get(a.id);
      a.enrolled_count = enrolledCount;
      a.marked_count = fullyMarked;
      a.is_fully_marked = enrolledCount > 0 && fullyMarked >= enrolledCount;
      a.has_any_marks = anyMarked > 0;
      a.marked_by_teacher_id = teacherInfo?.id || null;
      a.marked_by_teacher_name = teacherInfo?.name || null;
      a.marked_by_teacher_name_ur = teacherInfo?.name_ur || null;
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

    submissions = await db('homework_submissions as hs')
      .leftJoin('users as u', 'u.id', 'hs.marked_by')
      .where({ 'hs.assignment_id': assignmentId, 'hs.class_id': classId, 'hs.is_active': true })
      .select('hs.*', 'u.full_name as marked_by_name', 'u.full_name_ur as marked_by_name_ur');
  }

  const evaluatedSubmissions = submissions.filter(s => s.status === 'evaluated');
  const isFullyMarked = students.length > 0 && evaluatedSubmissions.length >= students.length;
  const evaluatorSub = submissions.find(s => s.marked_by && s.marked_by_name);

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
    is_fully_marked: isFullyMarked,
    evaluator_teacher_id: evaluatorSub?.marked_by || null,
    evaluator_teacher_name: evaluatorSub?.marked_by_name || null,
    evaluator_teacher_name_ur: evaluatorSub?.marked_by_name_ur || null,
  };
}




// ── Submissions ───────────────────────────────────────────────────────────────

async function listSubmissionsForAssignment(assignmentId, classId) {
  return db('homework_submissions')
    .where({ assignment_id: assignmentId, class_id: classId, is_active: true });
}

async function listSubmissionsForStudentInClass(classId, studentId) {
  return db('homework_submissions as hs')
    .leftJoin('users as u', 'u.id', 'hs.marked_by')
    .where({ 'hs.class_id': classId, 'hs.student_id': studentId, 'hs.is_active': true })
    .select('hs.*', 'u.full_name as marked_by_name', 'u.full_name_ur as marked_by_name_ur');
}

async function upsertSubmission({ assignmentId, classId, studentId, status, marksAwarded, maxMarks, teacherNote, markedBy }) {
  const existing = await db('homework_submissions')
    .where({ assignment_id: assignmentId, class_id: classId, student_id: studentId })
    .first();

  if (existing) {
    const [row] = await db('homework_submissions')
      .where({ id: existing.id })
      .update({
        status:        status ?? existing.status,
        marks_awarded: marksAwarded ?? existing.marks_awarded,
        max_marks:     maxMarks ?? existing.max_marks,
        teacher_note:  teacherNote ?? existing.teacher_note,
        marked_by:     markedBy ?? existing.marked_by,
        marked_at:     markedBy ? db.fn.now() : existing.marked_at,
        updated_at:    db.fn.now(),
      })
      .returning('*');
    return row;
  }

  const [row] = await db('homework_submissions')
    .insert({
      assignment_id: assignmentId,
      class_id:      classId,
      student_id:    studentId,
      status:        status ?? 'pending',
      marks_awarded: marksAwarded ?? null,
      max_marks:     maxMarks ?? null,
      teacher_note:  teacherNote ?? null,
      marked_by:     markedBy ?? null,
      marked_at:     markedBy ? db.fn.now() : null,
    })
    .returning('*');
  return row;
}


async function bulkUpsertHomeworkMarks({ assignmentId, classId, marks = [], studentNotes = {}, userId }) {
  return db.transaction(async (trx) => {
    // 1. Gather candidate subtopic_ids from payload
    const candidateSubtopicIds = Array.from(
      new Set(
        marks
          .map((m) => m.subtopic_id)
          .filter((id) => id && id !== 'default' && id !== 'null' && typeof id === 'string')
      )
    );

    // 2. Query subtopic_ids that actually exist in topic_subtopics table
    const validSubtopicIds = new Set();
    if (candidateSubtopicIds.length > 0) {
      const existingRows = await trx('topic_subtopics')
        .whereIn('id', candidateSubtopicIds)
        .select('id');
      existingRows.forEach((r) => validSubtopicIds.add(r.id));
    }

    const studentScores = new Map();

    for (const item of marks) {
      const { student_id, word_id, subtopic_id, marks_awarded = 0, error_type, teacher_note } = item;
      if (!student_id || !word_id || String(word_id).startsWith('content-')) continue;

      const safeSubtopicId = (subtopic_id && validSubtopicIds.has(subtopic_id)) ? subtopic_id : null;

      await trx.raw(
        `INSERT INTO homework_marks
          (assignment_id, class_id, student_id, word_id, subtopic_id, marks_awarded, error_type, teacher_note, marked_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT ON CONSTRAINT idx_unique_homework_mark
         DO UPDATE SET
          marks_awarded = EXCLUDED.marks_awarded,
          error_type    = EXCLUDED.error_type,
          teacher_note  = EXCLUDED.teacher_note,
          marked_by     = EXCLUDED.marked_by,
          updated_at    = NOW(),
          is_active     = true`,
        [
          assignmentId,
          classId || null,
          student_id,
          word_id,
          safeSubtopicId,
          marks_awarded,
          error_type || null,
          teacher_note || null,
          userId,
        ]
      );

      const currentScore = studentScores.get(student_id) || 0;
      studentScores.set(student_id, currentScore + Number(marks_awarded || 0));
    }

    const gridData = await getHomeworkGridSheet({ assignmentId, classId });
    const maxMarks = gridData?.calculated_max_marks || 0;

    // Count total expected word entries from the assignment content
    let totalExpectedWords = 0;
    for (const c of (gridData?.contents || [])) {
      const words = c.words || [];
      totalExpectedWords += words.length > 0 ? words.length : 1; // at least 1 per content item
    }

    const allStudentIds = new Set([...studentScores.keys(), ...Object.keys(studentNotes || {})].filter(id => id && id !== 'NaN' && id !== 'undefined'));

    // Update submissions for each student
    for (const student_id of allStudentIds) {
      if (!student_id || student_id === 'NaN') continue;
      const totalAwarded = studentScores.get(student_id) ?? 0;
      const note = studentNotes[student_id] ?? 'Evaluated via Homework Grid Sheet';

      // Count how many word-level marks this student actually has saved
      const studentMarksCount = await trx('homework_marks')
        .where({ assignment_id: assignmentId, class_id: classId, student_id, is_active: true })
        .count('* as cnt')
        .first();
      const markedWords = Number(studentMarksCount?.cnt || 0);

      // Only set 'evaluated' when ALL words are graded; otherwise 'in_progress'
      const submissionStatus = (totalExpectedWords > 0 && markedWords >= totalExpectedWords)
        ? 'evaluated'
        : 'in_progress';

      await upsertSubmission({
        assignmentId,
        classId,
        studentId: student_id,
        status: submissionStatus,
        marksAwarded: totalAwarded,
        maxMarks,
        teacherNote: note,
        markedBy: userId,
      });
    }

    return getHomeworkGridSheet({ assignmentId, classId });
  });
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
  getHomeworkGridSheet,
  bulkUpsertHomeworkMarks,
  listSubmissionsForAssignment,
  listSubmissionsForStudentInClass,
  upsertSubmission
};

