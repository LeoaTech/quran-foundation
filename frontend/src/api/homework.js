import client from './client';

// GET  /courses/:courseId/homework-schedule
export const getHomeworkSchedule = (courseId) =>
  client.get(`/courses/${courseId}/homework-schedule`).then((r) => r.data);

// PUT  /courses/:courseId/homework-schedule
export const saveHomeworkSchedule = (courseId, body) =>
  client.put(`/courses/${courseId}/homework-schedule`, body).then((r) => r.data);

