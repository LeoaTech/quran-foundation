const service = require('../services/attendance.service');

async function createAttendanceSession(req, res, next) {
  try {
    res.status(201).json(await service.createAttendanceSession({
      user:    req.user,
      classId: req.params.class_id,
      body:    req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function listSessionsByClass(req, res, next) {
  try {
    res.json(await service.listSessionsByClass({
      user:    req.user,
      classId: req.params.class_id,
      query:   req.query,
    }));
  } catch (err) {
    next(err);
  }
}

async function correctRecord(req, res, next) {
  try {
    res.json(await service.correctRecord({
      user:      req.user,
      sessionId: req.params.session_id,
      recordId:  req.params.record_id,
      body:      req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function getStudentAttendance(req, res, next) {
  try {
    res.json(await service.getStudentAttendance({
      user:          req.user,
      studentUserId: req.params.user_id,
      query:         req.query,
    }));
  } catch (err) {
    next(err);
  }
}

async function getSessionRecords(req, res, next) {
  try {
    res.json(await service.getSessionRecords({
      user:      req.user,
      sessionId: req.params.session_id,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAttendanceSession,
  listSessionsByClass,
  correctRecord,
  getStudentAttendance,
  getSessionRecords,
};
