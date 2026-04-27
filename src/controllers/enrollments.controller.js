const service = require('../services/enrollments.service');

async function createEnrollment(req, res, next) {
  try {
    res.status(201).json(await service.createEnrollment({ user: req.user, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function listEnrollmentsByClass(req, res, next) {
  try {
    res.json(await service.listEnrollmentsByClass({ user: req.user, classId: req.params.class_id, query: req.query }));
  } catch (err) {
    next(err);
  }
}

async function listEnrollmentsByStudent(req, res, next) {
  try {
    res.json(await service.listEnrollmentsByStudent({ user: req.user, studentUserId: req.params.user_id }));
  } catch (err) {
    next(err);
  }
}

async function updateEnrollment(req, res, next) {
  try {
    res.json(await service.updateEnrollment({ user: req.user, enrollmentId: req.params.enrollment_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createEnrollment,
  listEnrollmentsByClass,
  listEnrollmentsByStudent,
  updateEnrollment,
};
