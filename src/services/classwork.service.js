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
    throw notFound("Classwork Content");
  return content;
}

async function requireWord(wordId, contentId) {
  const word = await repo.getWordById(wordId);
  if (!word || word.content_id !== contentId) throw notFound("Classwork Word");
  return word;
}

// ── Content ────────────────────────────────────────────────────────────────────

async function listContent({ courseId, query = {} }) {
  await requireCourse(courseId);
  return repo.listContent({
    courseId,
    courseLevelId: query.level_id,
    topicId: query.topic_id,
  });
}

async function deleteContent({ user, courseId, contentId }) {
  const course = await requireCourse(courseId);
  await requireContent(contentId, courseId);
  const result = await repo.deactivateContent(contentId);
  activityLog
    .log({
      actor: user,
      action: "classwork_content.delete",
      entity_type: "classwork_content",
      entity_id: contentId,
      org_id: course.org_id,
      summary_en: `Removed classwork content`,
      metadata: { content_id: contentId },
    })
    .catch(() => {});
  return result;
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
};
