import client from './client';

export const getCenterTeacherTopics = (centerId) =>
  client.get(`/centers/${centerId}/teacher-topics`).then((r) => r.data);

export const assignTeacherTopic = (centerId, payload) =>
  client.post(`/centers/${centerId}/teacher-topics`, payload).then((r) => r.data);

export const removeTeacherTopic = (centerId, assignmentId) =>
  client.delete(`/centers/${centerId}/teacher-topics/${assignmentId}`).then((r) => r.data);

export const updateTeacherTopic = (centerId, assignmentId, payload) =>
  client.put(`/centers/${centerId}/teacher-topics/${assignmentId}`, payload).then((r) => r.data);
