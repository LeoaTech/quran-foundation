const service = require('../services/teacherTopics.service');

async function listTeacherTopics(req, res, next) {
  try {
    const assignments = await service.listTeacherTopics({
      user: req.user,
      centerId: req.params.center_id,
    });
    res.json(assignments);
  } catch (err) {
    next(err);
  }
}

async function createAssignment(req, res, next) {
  try {
    const assignment = await service.createAssignment({
      user: req.user,
      centerId: req.params.center_id,
      body: req.body,
    });
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
}

async function deleteAssignment(req, res, next) {
  try {
    await service.deleteAssignment({
      user: req.user,
      centerId: req.params.center_id,
      assignmentId: req.params.assignment_id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function updateAssignment(req, res, next) {
  try {
    const assignment = await service.updateAssignment({
      user: req.user,
      centerId: req.params.center_id,
      assignmentId: req.params.assignment_id,
      body: req.body,
    });
    res.json(assignment);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTeacherTopics,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
