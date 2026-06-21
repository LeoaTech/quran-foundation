const service = require('../services/enrollments.service');
const { uploadImage } = require('../services/cloudinary.service');

async function createEnrollment(req, res, next) {
  try {
    res.status(201).json(await service.createEnrollment({ user: req.user, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function enrollNewStudent(req, res, next) {
  try {
    const body = { ...req.body };
    
    if (req.file) {
      const profilePictureUrl = await uploadImage(req.file.buffer, 'profiles');
      if (profilePictureUrl) {
        body.profile_picture = profilePictureUrl;
      }
    }

    res.status(201).json(await service.enrollNewStudent({ user: req.user, body }));
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

async function listEnrollmentsByCenter(req, res, next) {
  try {
    res.json(await service.listEnrollmentsByCenter({ user: req.user, centerId: req.params.center_id, query: req.query }));
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
  enrollNewStudent,
  listEnrollmentsByClass,
  listEnrollmentsByCenter,
  listEnrollmentsByStudent,
  updateEnrollment,
};
