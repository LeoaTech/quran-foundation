const service = require('../services/assessments.service');

async function createAssessment(req, res, next) {
  try {
    res.status(201).json(await service.createAssessment({
      user:    req.user,
      classId: req.params.class_id,
      body:    req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function listAssessmentsByClass(req, res, next) {
  try {
    res.json(await service.listAssessmentsByClass({
      user:    req.user,
      classId: req.params.class_id,
      query:   req.query,
    }));
  } catch (err) {
    next(err);
  }
}

async function getAssessment(req, res, next) {
  try {
    res.json(await service.getAssessment({
      user:         req.user,
      assessmentId: req.params.assessment_id,
    }));
  } catch (err) {
    next(err);
  }
}

async function createResults(req, res, next) {
  try {
    res.status(201).json(await service.createResults({
      user:         req.user,
      assessmentId: req.params.assessment_id,
      body:         req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function listResults(req, res, next) {
  try {
    res.json(await service.listResults({
      user:         req.user,
      assessmentId: req.params.assessment_id,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateResult(req, res, next) {
  try {
    res.json(await service.updateResult({
      user:         req.user,
      assessmentId: req.params.assessment_id,
      resultId:     req.params.result_id,
      body:         req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function listStudentAssessments(req, res, next) {
  try {
    res.json(await service.listStudentAssessments({
      user:          req.user,
      studentUserId: req.params.user_id,
      query:         req.query,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssessment,
  listAssessmentsByClass,
  getAssessment,
  createResults,
  listResults,
  updateResult,
  listStudentAssessments,
};
