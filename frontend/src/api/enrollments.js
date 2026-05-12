import client from './client';

export const createEnrollment = (payload) =>
  client.post('/enrollments', payload).then((r) => r.data);

export const getClassEnrollments = (classId, params = {}) =>
  client.get(`/classes/${classId}/enrollments`, { params }).then((r) => r.data);

export const getCenterEnrollments = (centerId, params = {}) =>
  client.get(`/centers/${centerId}/enrollments`, { params }).then((r) => r.data);

export const getStudentEnrollments = (userId) =>
  client.get(`/students/${userId}/enrollments`).then((r) => r.data);

export const updateEnrollment = (enrollmentId, payload) =>
  client.patch(`/enrollments/${enrollmentId}`, payload).then((r) => r.data);

export async function enrollNewStudent(data) {
  const res = await client.post('/enrollments/enroll-student', data);
  return res.data;
}

export async function enrollExistingStudent(data) {
  const res = await client.post('/enrollments', data);
  return res.data;
}
