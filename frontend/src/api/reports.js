import client from './client';

export const getOrgOverview = () =>
  client.get('/reports/org/overview').then((r) => r.data);

export const getCenterOverview = (centerId, month) =>
  client.get(`/reports/centers/${centerId}/overview`, { params: month ? { month } : {} }).then((r) => r.data);

export const getStudentSummary = (userId) =>
  client.get(`/reports/students/${userId}/summary`).then((r) => r.data);

export const getHomeworkPerformance = (classId, params = {}) =>
  client.get(`/reports/classes/${classId}/homework-performance`, { params }).then((r) => r.data);
