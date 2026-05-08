import client from './client';

export const createAttendanceSession = (classId, payload) =>
  client.post(`/classes/${classId}/attendance`, payload).then((r) => r.data);

export const getClassAttendance = (classId, params = {}) =>
  client.get(`/classes/${classId}/attendance`, { params }).then((r) => r.data);

export const getSessionRecords = (sessionId) =>
  client.get(`/attendance/sessions/${sessionId}/records`).then((r) => r.data);

export const updateRecord = (sessionId, recordId, payload) =>
  client.patch(`/attendance/sessions/${sessionId}/records/${recordId}`, payload).then((r) => r.data);

export const getStudentAttendance = (userId, params = {}) =>
  client.get(`/students/${userId}/attendance`, { params }).then((r) => r.data);
