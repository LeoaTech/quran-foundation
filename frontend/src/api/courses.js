import client from './client';



// ── Courses ───────────────────────────────────────────────────────────────────
export async function getCourses() {
  const res = await client.get('/courses');
  return res.data;
}

export async function getCourseLevels(courseId) {
  const res = await client.get(`/courses/${courseId}/levels`);
  return res.data;
}

export const createCourse = (payload) =>
  client.post('/courses', payload).then((r) => r.data);

export const updateCourse = (courseId, payload) =>
  client.patch(`/courses/${courseId}`, payload).then((r) => r.data);

// ── Topics ────────────────────────────────────────────────────────────────────
export const getTopics = (courseId) =>
  client.get(`/courses/${courseId}/topics`).then((r) => r.data);

export const createTopic = (courseId, payload) =>
  client.post(`/courses/${courseId}/topics`, payload).then((r) => r.data);

export const updateTopic = (courseId, topicId, payload) =>
  client.patch(`/courses/${courseId}/topics/${topicId}`, payload).then((r) => r.data);

export const deleteTopic = (courseId, topicId) =>
  client.delete(`/courses/${courseId}/topics/${topicId}`).then((r) => r.data);

// ── Subtopics ─────────────────────────────────────────────────────────────────
export const createSubtopic = (courseId, topicId, payload) =>
  client.post(`/courses/${courseId}/topics/${topicId}/subtopics`, payload).then((r) => r.data);

export const updateSubtopic = (courseId, topicId, subtopicId, payload) =>
  client.patch(`/courses/${courseId}/topics/${topicId}/subtopics/${subtopicId}`, payload).then((r) => r.data);

export const deleteSubtopic = (courseId, topicId, subtopicId) =>
  client.delete(`/courses/${courseId}/topics/${topicId}/subtopics/${subtopicId}`).then((r) => r.data);

// ── Course levels ─────────────────────────────────────────────────────────────

export const createCourseLevel = (courseId, payload) =>
  client.post(`/courses/${courseId}/levels`, payload).then((r) => r.data);

export const updateCourseLevel = (courseId, levelId, payload) =>
  client.patch(`/courses/${courseId}/levels/${levelId}`, payload).then((r) => r.data);

// ── Course Level Fees ──────────────────────────────────────────────────────────

export const getCourseFees = (courseId) =>
  client.get(`/courses/${courseId}/fees`).then((r) => r.data);

export const upsertLevelFee = (courseId, levelId, payload) =>
  client.put(`/courses/${courseId}/levels/${levelId}/fee`, payload).then((r) => r.data);

export const deleteLevelFee = (courseId, levelId) =>
  client.delete(`/courses/${courseId}/levels/${levelId}/fee`).then((r) => r.data);


// ── Homework assignments Content (Verses + Words) ───────────────────────────────────────
export const getHomeworkContent = (courseId, params = {}) =>
  client.get(`/courses/${courseId}/homework-content`, { params }).then((r) => r.data);

export const createHomeworkContent = (courseId, payload) =>
  client.post(`/courses/${courseId}/homework-content`, payload).then((r) => r.data);

export const updateHomeworkContent = (courseId, contentId, payload) =>
  client.patch(`/courses/${courseId}/homework-content/${contentId}`, payload).then((r) => r.data);

export const deleteHomeworkContent = (courseId, contentId) =>
  client.delete(`/courses/${courseId}/homework-content/${contentId}`).then((r) => r.data);

