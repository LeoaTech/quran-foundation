const service = require('../services/reports.service');

async function getOrgOverview(req, res, next) {
  try {
    res.json(await service.getOrgOverview());
  } catch (err) {
    next(err);
  }
}

async function getCenterOverview(req, res, next) {
  try {
    res.json(await service.getCenterOverview({
      user:     req.user,
      centerId: req.params.center_id,
      query:    req.query,
    }));
  } catch (err) {
    next(err);
  }
}

async function getStudentSummary(req, res, next) {
  try {
    res.json(await service.getStudentSummary({
      studentUserId: req.params.user_id,
    }));
  } catch (err) {
    next(err);
  }
}

async function getHomeworkPerformance(req, res, next) {
  try {
    res.json(await service.getHomeworkPerformance({
      user:    req.user,
      classId: req.params.class_id,
      query:   req.query,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrgOverview,
  getCenterOverview,
  getStudentSummary,
  getHomeworkPerformance,
};
