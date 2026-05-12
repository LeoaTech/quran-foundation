const repo   = require('../repositories/courses.repository');
const orgRepo = require('../repositories/centers.repository');
const activityLog = require('./activityLog.service');
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

// Verify the level belongs to the given course.
async function requireLevel(levelId, courseId) {
  const level = await repo.getLevelById(levelId);
  if (!level || level.course_id !== courseId) throw notFound('Course Level');
  return level;
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

async function createCourse({ user, body }) {
  const org = await orgRepo.getOrg();
  if (!org) {
    throw new AppError(
      'NOT_FOUND',
      'No organization found. Create an organization first.',
      'کوئی ادارہ نہیں ملا۔ پہلے ادارہ بنائیں۔',
      404,
    );
  }
  const course = await repo.createCourse({ ...body, org_id: org.id });
  activityLog.log({
    actor:       user,
    action:      'course.create',
    entity_type: 'course',
    entity_id:   course.id,
    org_id:      org.id,
    summary_en:  `Created course "${course.name}"`,
    metadata:    { course_name: course.name },
  }).catch(() => {});
  return course;
}

async function updateCourse({ user, courseId, body }) {
  await requireCourse(courseId);
  const course = await repo.updateCourse(courseId, body);
  activityLog.log({
    actor:       user,
    action:      'course.update',
    entity_type: 'course',
    entity_id:   course.id,
    org_id:      course.org_id,
    summary_en:  `Updated course "${course.name}"`,
    metadata:    { course_name: course.name },
  }).catch(() => {});
  return course;
}

// ── Course Levels ──────────────────────────────────────────────────────────────

async function getLevels({ courseId }) {
  await requireCourse(courseId);
  return repo.listLevelsByCourse(courseId);
}

async function createLevel({ user, courseId, body }) {
  const course = await requireCourse(courseId);
  const level = await repo.createLevel({ ...body, course_id: courseId });
  activityLog.log({
    actor:       user,
    action:      'course_level.create',
    entity_type: 'course_level',
    entity_id:   level.id,
    org_id:      course.org_id,
    summary_en:  `Added level "${level.title}" to course "${course.name}"`,
    metadata:    { course_name: course.name, level_title: level.title },
  }).catch(() => {});
  return level;
}

async function updateLevel({ user, courseId, levelId, body }) {
  const course = await requireCourse(courseId);
  await requireLevel(levelId, courseId);
  const level = await repo.updateLevel(levelId, body);
  activityLog.log({
    actor:       user,
    action:      'course_level.update',
    entity_type: 'course_level',
    entity_id:   level.id,
    org_id:      course.org_id,
    summary_en:  `Updated level "${level.title}" of course "${course.name}"`,
    metadata:    { course_name: course.name, level_title: level.title },
  }).catch(() => {});
  return level;
}

// ── Course Level Fees ──────────────────────────────────────────────────────────

async function getCourseFees({ courseId }) {
  await requireCourse(courseId);
  return repo.listFeesForCourse(courseId);
}

async function upsertCourseLevelFee({ user, courseId, levelId, body }) {
  const course = await requireCourse(courseId);
  const level  = await requireLevel(levelId, courseId);
  const fee = await repo.upsertFee(levelId, body);
  activityLog.log({
    actor:       user,
    action:      'fee.upsert',
    entity_type: 'course_level_fee',
    entity_id:   fee.id,
    org_id:      course.org_id,
    summary_en:  `Set fee ${fee.currency} ${fee.full_fee} for "${level.title}" of "${course.name}"`,
    metadata:    { course_name: course.name, level_title: level.title, currency: fee.currency, full_fee: fee.full_fee },
  }).catch(() => {});
  return fee;
}

async function deleteCourseLevelFee({ user, courseId, levelId }) {
  const course = await requireCourse(courseId);
  const level  = await requireLevel(levelId, courseId);
  const fee = await repo.deleteFee(levelId);
  activityLog.log({
    actor:       user,
    action:      'fee.delete',
    entity_type: 'course_level_fee',
    entity_id:   fee ? fee.id : null,
    org_id:      course.org_id,
    summary_en:  `Removed fee for "${level.title}" of "${course.name}"`,
    metadata:    { course_name: course.name, level_title: level.title },
  }).catch(() => {});
  return fee;
}

// ── Topics ────────────────────────────────────────────────────────────────────

async function getTopics({ courseId }) {
  await requireCourse(courseId);
  return repo.getTopicsWithSubtopics(courseId);
}

async function createTopic({ user, courseId, body }) {
  const course = await requireCourse(courseId);
  const topic = await repo.createTopic({
    ...body,
    course_id:  courseId,
    created_by: user.id,
  });
  activityLog.log({
    actor:       user,
    action:      'topic.create',
    entity_type: 'topic',
    entity_id:   topic.id,
    org_id:      course.org_id,
    summary_en:  `Added topic "${topic.title}" to course "${course.name}"`,
    metadata:    { course_name: course.name, topic_title: topic.title },
  }).catch(() => {});
  return topic;
}

async function updateTopic({ user, courseId, topicId, body }) {
  const course   = await requireCourse(courseId);
  const existing = await requireTopic(topicId, courseId);
  const topic = await repo.updateTopic(topicId, body);
  activityLog.log({
    actor:       user,
    action:      'topic.update',
    entity_type: 'topic',
    entity_id:   topic.id,
    org_id:      course.org_id,
    summary_en:  `Updated topic "${topic.title || existing.title}"`,
    metadata:    { course_name: course.name, topic_title: topic.title },
  }).catch(() => {});
  return topic;
}

async function deleteTopic({ user, courseId, topicId }) {
  const course = await requireCourse(courseId);
  const topic  = await requireTopic(topicId, courseId);
  const result = await repo.deactivateTopic(topicId);
  activityLog.log({
    actor:       user,
    action:      'topic.delete',
    entity_type: 'topic',
    entity_id:   topicId,
    org_id:      course.org_id,
    summary_en:  `Removed topic "${topic.title}" from course "${course.name}"`,
    metadata:    { course_name: course.name, topic_title: topic.title },
  }).catch(() => {});
  return result;
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
  getLevels,
  createLevel,
  updateLevel,
  getCourseFees,
  upsertCourseLevelFee,
  deleteCourseLevelFee,
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  createSubtopic,
  updateSubtopic,
  deleteSubtopic,
};
