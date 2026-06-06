import client from './client';

export async function getCenterClasses(centerId) {
  const res = await client.get(`/centers/${centerId}/classrooms`);
  return res.data;
}

// ── Classes ───────────────────────────────────────────────────────────────────
export const getClasses = (centerId, params = {}) =>
  client.get(`/centers/${centerId}/classes`, { params }).then((r) => r.data);

export const createClass = (centerId, payload) =>
  client.post(`/centers/${centerId}/classes`, payload).then((r) => r.data);

export const getClass = (classId) =>
  client.get(`/classes/${classId}`).then((r) => r.data);

export const updateClass = (classId, payload) =>
  client.patch(`/classes/${classId}`, payload).then((r) => r.data);

// ── Teachers ──────────────────────────────────────────────────────────────────
export const getClassTeachers = (classId) =>
  client.get(`/classes/${classId}/teachers`).then((r) => r.data);

export const assignTeacher = (classId, payload) =>
  client.post(`/classes/${classId}/teachers`, payload).then((r) => r.data);

export const removeTeacher = (classId, teacherUserId) =>
  client.delete(`/classes/${classId}/teachers/${teacherUserId}`).then((r) => r.data);

// ── Homework criteria ─────────────────────────────────────────────────────────
export const getHomeworkCriteria = (classId) =>
  client.get(`/classes/${classId}/homework-criteria`).then((r) => r.data);

export const createCriterion = (classId, payload) =>
  client.post(`/classes/${classId}/homework-criteria`, payload).then((r) => r.data);

export const updateCriterion = (classId, criteriaId, payload) =>
  client.patch(`/classes/${classId}/homework-criteria/${criteriaId}`, payload).then((r) => r.data);

export const deactivateCriterion = (classId, criteriaId) =>
  client.patch(`/classes/${classId}/homework-criteria/${criteriaId}`, { is_active: false }).then((r) => r.data);

// ── Enrollments (read) ────────────────────────────────────────────────────────
export const getClassEnrollments = (classId, params = {}) =>
  client.get(`/classes/${classId}/enrollments`, { params }).then((r) => r.data);

// ── Class Room Schedules ───────────────────────────────────────────────────────────
export const getClassSchedules = (classId) =>
  client.get(`/classes/${classId}/schedules`).then((r) => r.data);

export const createClassSchedule = (classId, payload) =>
  client.post(`/classes/${classId}/schedules`, payload).then((r) => r.data);

export const deleteClassSchedule = (classId, scheduleId) =>
  client.delete(`/classes/${classId}/schedules/${scheduleId}`).then((r) => r.data);

