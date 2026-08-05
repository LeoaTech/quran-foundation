const db = require("../db/knex");

// ── homework_content ─────────────────────────────────────────────────────────

/**
 * List all active content for a course, optionally filtered by level or topic.
 * Each row comes back with its nested words array.
 */
async function listContent({ courseId, courseLevelId, topicId } = {}) {
  const query = db("classwork_content as c")
    .leftJoin("topics as t", "t.id", "c.topic_id")
    .leftJoin("course_levels as l", "l.id", "c.course_level_id")
    .where("c.course_id", courseId)
    .where("c.is_active", true)
    .select(
      "c.id",
      "c.course_id",
      "c.course_level_id",
      "l.title          as level_title",
      "l.title_ur       as level_title_ur",
      "c.topic_id",
      "t.title          as topic_title",
      "t.title_ur       as topic_title_ur",
      "c.surah_number",
      "c.ayah_number",
      "c.arabic_text",
      "c.label",
      "c.topic_ids",
      "c.rule_marks",
      "c.total_marks",
      "c.created_by",
      "c.created_at",
    )
    .orderBy("c.created_at", "asc");

  if (courseLevelId) query.where("c.course_level_id", courseLevelId);
  if (topicId) query.where("c.topic_id", topicId);

  const contentRows = await query;

  if (contentRows.length === 0) return [];

  // Batch-load words for all returned content rows
  const ids = contentRows.map((r) => r.id);
  const wordRows = await db("classwork_content_words")
    .whereIn("content_id", ids)
    .where("is_active", true)
    .orderBy("sequence_order", "asc");

  const wordMap = new Map();
  for (const w of wordRows) {
    if (!wordMap.has(w.content_id)) wordMap.set(w.content_id, []);
    wordMap.get(w.content_id).push(w);
  }

  return contentRows.map((c) => ({
    ...c,
    topic_ids:
      typeof c.topic_ids === "string"
        ? JSON.parse(c.topic_ids)
        : (c.topic_ids ?? []),
    rule_marks:
      typeof c.rule_marks === "string"
        ? JSON.parse(c.rule_marks)
        : (c.rule_marks ?? {}),
    words: (wordMap.get(c.id) ?? []).map((w) => ({
      ...w,
      topic_ids:
        typeof w.topic_ids === "string"
          ? JSON.parse(w.topic_ids)
          : (w.topic_ids ?? []),
      rule_details:
        typeof w.rule_details === "string"
          ? JSON.parse(w.rule_details)
          : (w.rule_details ?? []),
    })),
  }));
}

function getContentById(contentId) {
  return db("classwork_content").where({ id: contentId }).first();
}

async function createContent(data) {
  const [row] = await db("classwork_content").insert(data).returning("*");
  return row;
}

async function updateContent(contentId, data) {
  const [row] = await db("classwork_content")
    .where({ id: contentId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

async function deactivateContent(contentId) {
  const [row] = await db("classwork_content")
    .where({ id: contentId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

// ── classwork_content_words ───────────────────────────────────────────────────

function listWordsByContent(contentId) {
  return db("classwork_content_words")
    .where({ content_id: contentId, is_active: true })
    .orderBy("sequence_order", "asc");
}

function getWordById(wordId) {
  return db("classwork_content_words").where({ id: wordId }).first();
}

async function createWord(data) {
  const [row] = await db("classwork_content_words").insert(data).returning("*");
  return row;
}

async function bulkCreateWords(rows) {
  return db("classwork_content_words").insert(rows).returning("*");
}

async function updateWord(wordId, data) {
  const [row] = await db("classwork_content_words")
    .where({ id: wordId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

async function deactivateWord(wordId) {
  const [row] = await db("classwork_content_words")
    .where({ id: wordId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

async function replaceWords(contentId, wordRows) {
  await db("classwork_content_words").where({ content_id: contentId }).delete();
  if (!wordRows.length) return [];
  return db("classwork_content_words").insert(wordRows).returning("*");
}

// ── classwork_sheets ──────────────────────────────────────────────────────────

async function getTopicsUpToSession(sessionId) {
  const session = await db("class_session_plans")
    .where({ id: sessionId })
    .first();
  if (!session) return { session: null, topics: [] };

  const classRow = await db("classes").where({ id: session.class_id }).first();
  if (!classRow) return { session, topics: [] };

  // All session plans for this class up to current session date
  const previousSessions = await db("class_session_plans")
    .where("class_id", session.class_id)
    .where("session_date", "<=", session.session_date)
    .whereNotNull("topic_id")
    .select("topic_id");

  let cumulativeTopicIds = [
    ...new Set(previousSessions.map((s) => s.topic_id)),
  ];

  if (session.topic_id && !cumulativeTopicIds.includes(session.topic_id)) {
    cumulativeTopicIds.push(session.topic_id);
  }

  let topicsQuery = db("topics as t")
    .leftJoin("topic_subtopics as s", function () {
      this.on("s.topic_id", "=", "t.id").andOnVal("s.is_active", "=", true);
    })
    .where("t.course_id", classRow.course_id)
    .where("t.is_active", true)
    .select(
      "t.id          as topic_id",
      "t.title       as topic_title",
      "t.title_ur    as topic_title_ur",
      "t.title_ar    as topic_title_ar",
      "t.display_order as topic_display_order",
      "s.id             as sub_id",
      "s.title          as sub_title",
      "s.title_ur       as sub_title_ur",
      "s.title_ar       as sub_title_ar",
      "s.display_order  as sub_display_order",
    )
    .orderBy("t.display_order", "asc")
    .orderBy("s.display_order", "asc");

  if (cumulativeTopicIds.length > 0) {
    topicsQuery = topicsQuery.whereIn("t.id", cumulativeTopicIds);
  }

  const rows = await topicsQuery;

  const topicMap = new Map();
  for (const row of rows) {
    if (!topicMap.has(row.topic_id)) {
      topicMap.set(row.topic_id, {
        id: row.topic_id,
        title: row.topic_title,
        title_ur: row.topic_title_ur,
        title_ar: row.topic_title_ar,
        display_order: row.topic_display_order,
        subtopics: [],
      });
    }
    if (row.sub_id) {
      topicMap.get(row.topic_id).subtopics.push({
        id: row.sub_id,
        title: row.sub_title,
        title_ur: row.sub_title_ur,
        title_ar: row.sub_title_ar,
        display_order: row.sub_display_order,
      });
    }
  }

  return {
    session,
    class: classRow,
    topics: Array.from(topicMap.values()),
  };
}

async function getPresentStudentsBySession(sessionId) {
  const session = await db("class_session_plans")
    .where({ id: sessionId })
    .first();
  if (!session) return [];

  const attendanceSession = await db("attendance_sessions")
    .where({
      class_id: session.class_id,
      session_date: session.session_date,
      is_active: true,
    })
    .first();

  if (attendanceSession) {
    const records = await db("attendance_records as r")
      .join("users as u", "u.id", "r.student_user_id")
      .where("r.session_id", attendanceSession.id)
      .whereIn("r.status", ["present", "late"])
      .where("r.is_active", true)
      .select(
        "u.id as student_id",
        "u.full_name",
        "u.full_name_ur",
        "r.status as attendance_status",
      )
      .orderBy("u.full_name", "asc");

    return records;
  }

  const enrollments = await db("enrollments as e")
    .join("users as u", "u.id", "e.student_user_id")
    .where("e.class_id", session.class_id)
    .where("e.status", "active")
    .where("e.is_active", true)
    .select(
      "u.id as student_id",
      "u.full_name",
      "u.full_name_ur",
      db.raw("'unmarked' as attendance_status"),
    )
    .orderBy("u.full_name", "asc");

  return enrollments;
}

async function getSheetBySession(sessionId) {
  const sheet = await db("classwork_sheets")
    .where({ class_session_id: sessionId })
    .first();

  if (!sheet) return null;

  const entries = await db("classwork_sheet_entries as e")
    .join("users as u", "u.id", "e.student_id")
    .leftJoin("topics as t", "t.id", "e.topic_id")
    .leftJoin("topic_subtopics as s", "s.id", "e.subtopic_id")
    .where("e.sheet_id", sheet.id)
    .where("e.is_active", true)
    .select(
      "e.id",
      "e.sheet_id",
      "e.student_id",
      "u.full_name as student_name",
      "u.full_name_ur as student_name_ur",
      "e.topic_id",
      "t.title as topic_title",
      "t.title_ur as topic_title_ur",
      "e.subtopic_id",
      "s.title as subtopic_title",
      "s.title_ur as subtopic_title_ur",
      "e.grade",
      "e.comments",
      "e.marked_by",
      "e.created_at",
      "e.updated_at",
    )
    .orderBy("u.full_name", "asc");

  return {
    ...sheet,
    entries,
  };
}

async function upsertSheet({
  sessionId,
  topicId,
  subtopicId,
  description,
  entries = [],
  userId,
}) {
  return db.transaction(async (trx) => {
    let sheet = await trx("classwork_sheets")
      .where({ class_session_id: sessionId })
      .first();

    if (sheet) {
      const [updated] = await trx("classwork_sheets")
        .where({ id: sheet.id })
        .update({
          topic_id: topicId ?? null,
          subtopic_id: subtopicId ?? null,
          description: description ?? null,
          updated_at: trx.fn.now(),
        })
        .returning("*");
      sheet = updated;
    } else {
      const [created] = await trx("classwork_sheets")
        .insert({
          class_session_id: sessionId,
          topic_id: topicId ?? null,
          subtopic_id: subtopicId ?? null,
          description: description ?? null,
          created_by: userId,
        })
        .returning("*");
      sheet = created;
    }

    for (const entry of entries) {
      const { student_id, topic_id, subtopic_id, grade, comments } = entry;
      if (!student_id) continue;

      await trx.raw(
        `INSERT INTO classwork_sheet_entries
          (sheet_id, student_id, topic_id, subtopic_id, grade, comments, marked_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT ON CONSTRAINT idx_unique_classwork_sheet_entry
         DO UPDATE SET
          topic_id    = EXCLUDED.topic_id,
          subtopic_id = EXCLUDED.subtopic_id,
          grade       = EXCLUDED.grade,
          comments    = EXCLUDED.comments,
          marked_by   = EXCLUDED.marked_by,
          updated_at  = NOW(),
          is_active   = true`,
        [
          sheet.id,
          student_id,
          topic_id ?? topicId ?? null,
          subtopic_id ?? subtopicId ?? null,
          grade != null ? String(grade) : null,
          comments ?? null,
          userId,
        ]
      );
    }

    return sheet;
  });
}

function getClassworkEntriesForStudentInClass(classId, studentUserId) {
  return db("classwork_sheet_entries as e")
    .join("classwork_sheets as s", "s.id", "e.sheet_id")
    .join("class_session_plans as p", "p.id", "s.class_session_id")
    .leftJoin("topics as t", "t.id", db.raw("COALESCE(e.topic_id, s.topic_id, p.topic_id)"))
    .leftJoin("topic_subtopics as st", "st.id", db.raw("COALESCE(e.subtopic_id, s.subtopic_id)"))
    .leftJoin("users as u_teacher", "u_teacher.id", db.raw("COALESCE(e.marked_by, s.created_by)"))
    .where("p.class_id", classId)
    .where("e.student_id", studentUserId)
    .where("e.is_active", true)
    .where("p.is_active", true)
    .select(
      "e.id",
      "s.class_session_id",
      "p.session_date",
      db.raw("COALESCE(t.title, p.topic_title) as session_title"),
      db.raw("COALESCE(e.topic_id, s.topic_id, p.topic_id) as topic_id"),
      db.raw("COALESCE(t.title, p.topic_title) as topic_title"),
      db.raw("COALESCE(t.title_ur, p.topic_title_ur) as topic_title_ur"),
      db.raw("COALESCE(e.subtopic_id, s.subtopic_id) as subtopic_id"),
      "st.title as subtopic_title",
      "st.title_ur as subtopic_title_ur",
      "e.grade",
      "e.comments",
      "u_teacher.full_name as teacher_name",
      "u_teacher.full_name_ur as teacher_name_ur",
      "e.updated_at"
    );
}

module.exports = {
  listContent,
  getContentById,
  createContent,
  updateContent,
  deactivateContent,
  listWordsByContent,
  getWordById,
  createWord,
  bulkCreateWords,
  updateWord,
  deactivateWord,
  replaceWords,
  getTopicsUpToSession,
  getPresentStudentsBySession,
  getSheetBySession,
  upsertSheet,
  getClassworkEntriesForStudentInClass,
};
