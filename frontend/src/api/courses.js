import client from './client';

// ── Courses ───────────────────────────────────────────────────────────────────
export const getCourses = (params = {}) =>
  client.get('/courses', { params }).then((r) => r.data);

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
export const getCourseLevels = (courseId) =>
  client.get(`/courses/${courseId}/levels`).then((r) => r.data);

export const createCourseLevel = (courseId, payload) =>
  client.post(`/courses/${courseId}/levels`, payload).then((r) => r.data);

export const updateCourseLevel = (courseId, levelId, payload) =>
  client.patch(`/courses/${courseId}/levels/${levelId}`, payload).then((r) => r.data);
