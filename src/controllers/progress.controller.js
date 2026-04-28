const service = require('../services/progress.service');

async function createProgressSession(req, res, next) {
  try {
    res.status(201).json(await service.createProgressSession({
      teacherUserId: req.user.id,
      body: req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function getProgressSession(req, res, next) {
  try {
    res.json(await service.getProgressSession({
      user:      req.user,
      sessionId: req.params.session_id,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateProgressSession(req, res, next) {
  try {
    res.json(await service.updateProgressSession({
      user:      req.user,
      sessionId: req.params.session_id,
      body:      req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function getStudentProgress(req, res, next) {
  try {
    res.json(await service.getStudentProgress({
      user:          req.user,
      studentUserId: req.params.user_id,
      query:         req.query,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateHomeworkEntry(req, res, next) {
  try {
    res.json(await service.updateHomeworkEntry({
      user:    req.user,
      entryId: req.params.entry_id,
      body:    req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateHomeworkScore(req, res, next) {
  try {
    res.json(await service.updateHomeworkScore({
      user:    req.user,
      entryId: req.params.entry_id,
      scoreId: req.params.score_id,
      body:    req.body,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProgressSession,
  getProgressSession,
  updateProgressSession,
  getStudentProgress,
  updateHomeworkEntry,
  updateHomeworkScore,
};
