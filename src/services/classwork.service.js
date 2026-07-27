const repo = require("../repositories/classwork.repository");
const coursesRepo = require("../repositories/courses.repository");
const activityLog = require("./activityLog.service");
const { AppError } = require("../utils/errors");

// ── Helpers ────────────────────────────────────────────────────────────────────

function notFound(entity = "Resource") {
  return new AppError(
    "NOT_FOUND",
    `${entity} not found.`,
    "مطلوبہ وسیلہ نہیں ملا۔",
    404,
  );
}

async function requireCourse(courseId) {
  const course = await coursesRepo.getCourseById(courseId);
  if (!course) throw notFound("Course");
  return course;
}

async function requireContent(contentId, courseId) {
  const content = await repo.getContentById(contentId);
  if (!content || content.course_id !== courseId)
    throw notFound("homework content");
  return content;
}

async function requireWord(wordId, contentId) {
  const word = await repo.getWordById(wordId);
  if (!word || word.content_id !== contentId) throw notFound("Content Word");
  return word;
}

// ── Content ────────────────────────────────────────────────────────────────────

/**
 * Compute grand total marks from word-level rule_details.
 *
 * words_List.rule_details = [{ subtopic_id, marks_per_rule, occurrence_count }]
 *
 * Total = Σ over all words and their rule_details entries:
 *           marks_per_rule × occurrence_count_of_rule_in_a_word
 */
function computeTotalMarks(words = []) {
  let total = 0;
  for (const w of words) {
    for (const rd of (w.rule_details ?? [])) {
      const marks = rd.marks_per_rule ?? 0;
      const occurrences = rd.occurrence_count ?? 1;
      total += marks * occurrences;
    }
  }
  return total;
}

async function listContent({ courseId, query = {} }) {
  await requireCourse(courseId);
  return repo.listContent({
    courseId,
    courseLevelId: query.level_id,
    topicId: query.topic_id,
  });
}

async function listContent({ courseId, query = {} }) {
  await requireCourse(courseId);
  return repo.listContent({
    courseId,
    courseLevelId: query.level_id,
    topicId:       query.topic_id,
  });
}

async function createContent({ user, courseId, body }) {
  const course = await requireCourse(courseId);

  const { words = [], rule_marks, ...contentData } = body;

  // Compute total_marks from word-level marks_per_rule × occurrence_count
  const totalMarks = computeTotalMarks(words);

  const content = await repo.createContent({
    ...contentData,
    course_id:   courseId,
    rule_marks:  JSON.stringify(rule_marks ?? {}),
    total_marks: totalMarks,
    created_by:  user.id,
  });

  // Bulk-insert all words in one go
  if (words.length > 0) {
    const wordRows = words.map((w, idx) => ({
      content_id:     content.id,
      word_text:      w.word_text,
      sequence_order: w.sequence_order ?? idx + 1,
      topic_ids:      JSON.stringify(w.topic_ids ?? []),
      rule_details:   JSON.stringify(w.rule_details ?? []),
      note:           w.note ?? null,
    }));
    await repo.bulkCreateWords(wordRows);
  }

  activityLog.log({
    actor:       user,
    action:      'homework_content.create',
    entity_type: 'homework_content',
    entity_id:   content.id,
    org_id:      course.org_id,
    summary_en:  `Added homework content for course "${course.name}"`,
    metadata:    { course_name: course.name, surah: contentData.surah_number, ayah: contentData.ayah_number, total_marks: totalMarks },
  }).catch(() => {});

  // Return with words attached
  const contentWithWords = await repo.listContent({ courseId });
  return contentWithWords.find((c) => c.id === content.id) ?? content;
}

async function updateContent({ user, courseId, contentId, body }) {
  const course = await requireCourse(courseId);
  await requireContent(contentId, courseId);

  const { words, rule_marks, ...contentData } = body;

  // Compute total_marks from word-level rule_details
  const patchData = { ...contentData };
  if (rule_marks !== undefined) {
    patchData.rule_marks = JSON.stringify(rule_marks);
  }
  if (Array.isArray(words)) {
    patchData.total_marks = computeTotalMarks(words);
  }

  const updated = await repo.updateContent(contentId, patchData);

  // If words are included, replace all words for this content
  if (Array.isArray(words)) {
    const wordRows = words.map((w, idx) => ({
      content_id:     contentId,
      word_text:      w.word_text,
      sequence_order: w.sequence_order ?? idx + 1,
      topic_ids:      JSON.stringify(w.topic_ids ?? []),
      rule_details:   JSON.stringify(w.rule_details ?? []),
      note:           w.note ?? null,
    }));
    await repo.replaceWords(contentId, wordRows);
  }

  activityLog.log({
    actor:       user,
    action:      'homework_content.update',
    entity_type: 'homework_content',
    entity_id:   contentId,
    org_id:      course.org_id,
    summary_en:  `Updated homework content`,
    metadata:    { content_id: contentId },
  }).catch(() => {});

  const list = await repo.listContent({ courseId });
  return list.find((c) => c.id === contentId) ?? updated;
}


async function deleteContent({ user, courseId, contentId }) {
  const course = await requireCourse(courseId);
  await requireContent(contentId, courseId);
  const result = await repo.deactivateContent(contentId);
  activityLog
    .log({
      actor: user,
      action: "homework_content.delete",
      entity_type: "homework_content",
      entity_id: contentId,
      org_id: course.org_id,
      summary_en: `Removed homework content`,
      metadata: { content_id: contentId },
    })
    .catch(() => {});
  return result;
}


// ── Words (individual word updates) ───────────────────────────────────────────

async function updateWord({ courseId, contentId, wordId, body }) {
  await requireCourse(courseId);
  await requireContent(contentId, courseId);
  await requireWord(wordId, contentId);
  return repo.updateWord(wordId, {
    word_text:      body.word_text,
    sequence_order: body.sequence_order,
    topic_ids:      body.topic_ids !== undefined ? JSON.stringify(body.topic_ids) : undefined,
  });
}

async function deleteWord({ courseId, contentId, wordId }) {
  await requireCourse(courseId);
  await requireContent(contentId, courseId);
  await requireWord(wordId, contentId);
  return repo.deactivateWord(wordId);
}

//  --------------Classwork Assignments -----------------------------
async function getSessionClassworkContext({ sessionId }) {
  const context = await repo.getTopicsUpToSession(sessionId);
  if (!context.session) throw notFound("Class Session");

  const presentStudents = await repo.getPresentStudentsBySession(sessionId);
  const sheet = await repo.getSheetBySession(sessionId);

  return {
    session: context.session,
    topics: context.topics,
    present_students: presentStudents,
    sheet,
  };
}

async function saveClassworkSheet({ user, sessionId, body }) {
  const context = await repo.getTopicsUpToSession(sessionId);
  if (!context.session) throw notFound("Class Session");

  await repo.upsertSheet({
    sessionId,
    topicId: body.topic_id,
    subtopicId: body.subtopic_id,
    description: body.description,
    entries: body.entries ?? [],
    userId: user.id,
  });

  activityLog
    .log({
      actor: user,
      action: "classwork_sheet.save",
      entity_type: "classwork_sheets",
      entity_id: sessionId,
      org_id: user.org_id,
      summary_en: `Saved classwork sheet for session`,
    })
    .catch(() => {});

  return repo.getSheetBySession(sessionId);
}

module.exports = {
  listContent,
  deleteContent,
  getSessionClassworkContext,
  saveClassworkSheet,
  createContent,
  updateContent,
  updateWord,
  deleteWord
};
