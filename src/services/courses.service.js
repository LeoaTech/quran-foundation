const repo   = require('../repositories/courses.repository');
const orgRepo = require('../repositories/centers.repository');
const { AppError } = require('../utils/errors');

// ── Helpers ────────────────────────────────────────────────────────────────────

function notFound(entity = 'Course') {
  return new AppError(
    'NOT_FOUND',
    `${entity} not found.`,
    'مطلوبہ وسیلہ نہیں ملا۔',
    404,
  );
}

// Verify the course exists and is active; throw 404 otherwise.
async function requireCourse(courseId) {
  const course = await repo.getCourseById(courseId);
  if (!course) throw notFound('Course');
  return course;
}

// Verify the topic belongs to the given course.
async function requireTopic(topicId, courseId) {
  const topic = await repo.getTopicById(topicId);
  if (!topic || topic.course_id !== courseId) throw notFound('Topic');
  return topic;
}

// Verify the subtopic belongs to the given topic.
async function requireSubtopic(subtopicId, topicId) {
  const sub = await repo.getSubtopicById(subtopicId);
  if (!sub || sub.topic_id !== topicId) throw notFound('Subtopic');
  return sub;
}

const VALID_TYPES = ['hifz', 'nazra', 'tajweed', 'arabic'];

// ── Courses ────────────────────────────────────────────────────────────────────

async function listCourses({ query = {} } = {}) {
  const isActive = query.is_active !== undefined
    ? query.is_active === 'true'
    : undefined;
  return repo.listCourses({ isActive });
}

async function getCourse({ courseId }) {
  return requireCourse(courseId);
}

async function createCourse({ body }) {
  const org = await orgRepo.getOrg();
  if (!org) {
    throw new AppError(
      'NOT_FOUND',
      'No organization found. Create an organization first.',
      'کوئی ادارہ نہیں ملا۔ پہلے ادارہ بنائیں۔',
      404,
    );
  }
  return repo.createCourse({ ...body, org_id: org.id });
}

async function updateCourse({ courseId, body }) {
  await requireCourse(courseId);
  return repo.updateCourse(courseId, body);
}

// ── Course Levels ──────────────────────────────────────────────────────────────

async function createLevel({ courseId, body }) {
  await requireCourse(courseId);
  return repo.createLevel({ ...body, course_id: courseId });
}

// ── Topics ────────────────────────────────────────────────────────────────────

async function getTopics({ courseId }) {
  await requireCourse(courseId);
  return repo.getTopicsWithSubtopics(courseId);
}

async function createTopic({ user, courseId, body }) {
  await requireCourse(courseId);
  return repo.createTopic({
    ...body,
    course_id:  courseId,
    created_by: user.id,
  });
}

async function updateTopic({ courseId, topicId, body }) {
  await requireTopic(topicId, courseId);
  return repo.updateTopic(topicId, body);
}

async function deleteTopic({ courseId, topicId }) {
  await requireTopic(topicId, courseId);
  return repo.deactivateTopic(topicId);
}

// ── Subtopics ─────────────────────────────────────────────────────────────────

async function createSubtopic({ courseId, topicId, body }) {
  await requireCourse(courseId);
  await requireTopic(topicId, courseId);
  return repo.createSubtopic({ ...body, topic_id: topicId });
}

async function updateSubtopic({ courseId, topicId, subtopicId, body }) {
  await requireCourse(courseId);
  await requireTopic(topicId, courseId);
  await requireSubtopic(subtopicId, topicId);
  return repo.updateSubtopic(subtopicId, body);
}

async function deleteSubtopic({ courseId, topicId, subtopicId }) {
  await requireCourse(courseId);
  await requireTopic(topicId, courseId);
  await requireSubtopic(subtopicId, topicId);
  return repo.deactivateSubtopic(subtopicId);
}

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  createLevel,
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  createSubtopic,
  updateSubtopic,
  deleteSubtopic,
};
