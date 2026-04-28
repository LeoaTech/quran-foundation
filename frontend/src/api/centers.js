import client from './client';

// ── Org ──────────────────────────────────────────────────────────────────────
export const getOrg = () =>
  client.get('/org').then((r) => r.data);

export const updateOrg = (payload) =>
  client.patch('/org', payload).then((r) => r.data);

// ── Centers ───────────────────────────────────────────────────────────────────
export const getCenters = (params = {}) =>
  client.get('/centers', { params }).then((r) => r.data);

export const createCenter = (payload) =>
  client.post('/centers', payload).then((r) => r.data);

export const getCenter = (centerId) =>
  client.get(`/centers/${centerId}`).then((r) => r.data);

export const updateCenter = (centerId, payload) =>
  client.patch(`/centers/${centerId}`, payload).then((r) => r.data);

// ── Classrooms ────────────────────────────────────────────────────────────────
export const getClassrooms = (centerId) =>
  client.get(`/centers/${centerId}/classrooms`).then((r) => r.data);

export const createClassroom = (centerId, payload) =>
  client.post(`/centers/${centerId}/classrooms`, payload).then((r) => r.data);

export const updateClassroom = (centerId, classroomId, payload) =>
  client.patch(`/centers/${centerId}/classrooms/${classroomId}`, payload).then((r) => r.data);

// ── Derived helpers (reports + classes endpoints) ─────────────────────────────
export const getCenterOverview = (centerId, params = {}) =>
  client.get(`/reports/centers/${centerId}/overview`, { params }).then((r) => r.data);

export const getCenterClasses = (centerId, params = {}) =>
  client.get(`/centers/${centerId}/classes`, { params }).then((r) => r.data);
