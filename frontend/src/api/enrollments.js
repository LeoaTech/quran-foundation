import client from './client';

export const createEnrollment = (payload) =>
  client.post('/enrollments', payload).then((r) => r.data);

export const getClassEnrollments = (classId, params = {}) =>
  client.get(`/classes/${classId}/enrollments`, { params }).then((r) => r.data);

export const getStudentEnrollments = (userId) =>
  client.get(`/students/${userId}/enrollments`).then((r) => r.data);

export const updateEnrollment = (enrollmentId, payload) =>
  client.patch(`/enrollments/${enrollmentId}`, payload).then((r) => r.data);
