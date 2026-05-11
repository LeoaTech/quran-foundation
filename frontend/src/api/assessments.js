import client from './client';

export const getClassAssessments = (classId) =>
  client.get(`/classes/${classId}/assessments`).then((r) => r.data);

export const createAssessment = (classId, payload) =>
  client.post(`/classes/${classId}/assessments`, payload).then((r) => r.data);

export const getAssessment = (assessmentId) =>
  client.get(`/assessments/${assessmentId}`).then((r) => r.data);

export const updateAssessment = (assessmentId, payload) =>
  client.patch(`/assessments/${assessmentId}`, payload).then((r) => r.data);

export const submitResults = (assessmentId, results) =>
  client.post(`/assessments/${assessmentId}/results`, { results }).then((r) => r.data);

export const updateResult = (assessmentId, resultId, payload) =>
  client.patch(`/assessments/${assessmentId}/results/${resultId}`, payload).then((r) => r.data);

export const getAssessmentResults = (assessmentId) =>
  client.get(`/assessments/${assessmentId}/results`).then((r) => r.data);

export const getStudentAssessments = (userId) =>
  client.get(`/students/${userId}/assessments`).then((r) => r.data);
