import client from "./client";

// GET  /courses/:courseId/homework-schedule
export const getHomeworkSchedule = (courseId) =>
  client.get(`/courses/${courseId}/homework-schedule`).then((r) => r.data);

// PUT  /courses/:courseId/homework-schedule
export const saveHomeworkSchedule = (courseId, body) =>
  client
    .put(`/courses/${courseId}/homework-schedule`, body)
    .then((r) => r.data);

// PATCH /courses/:courseId/homework-assignments/:assignmentId
export const updateHomeworkAssignment = (courseId, assignmentId, patch) =>
  client
    .patch(`/courses/${courseId}/homework-assignments/${assignmentId}`, patch)
    .then((r) => r.data);

// GET /courses/:courseId/homework-assignments/:assignmentId/content
export const getAssignmentContent = (courseId, assignmentId) =>
  client.get(`/courses/${courseId}/homework-assignments/${assignmentId}/content`).then((r) => r.data);


// PUT /courses/:courseId/homework-assignments/:assignmentId/content
export const linkAssignmentContent = (courseId, assignmentId, contentIds) =>
  client
    .put(`/courses/${courseId}/homework-assignments/${assignmentId}/content`, {
      content_ids: contentIds,
    })
    .then((r) => r.data);
