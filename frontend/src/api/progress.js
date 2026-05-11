import client from './client';

export const createSession = (payload) =>
  client.post('/progress-sessions', payload).then((r) => r.data);

export const getSession = (sessionId) =>
  client.get(`/progress-sessions/${sessionId}`).then((r) => r.data);

export const updateSession = (sessionId, payload) =>
  client.patch(`/progress-sessions/${sessionId}`, payload).then((r) => r.data);

export const getStudentProgress = (userId, params = {}) =>
  client.get(`/students/${userId}/progress`, { params }).then((r) => r.data);

export const updateHomeworkEntry = (entryId, payload) =>
  client.patch(`/homework-entries/${entryId}`, payload).then((r) => r.data);

export const updateHomeworkScore = (entryId, scoreId, payload) =>
  client.patch(`/homework-entries/${entryId}/scores/${scoreId}`, payload).then((r) => r.data);
