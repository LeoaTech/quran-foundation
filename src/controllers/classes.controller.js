const service = require('../services/classes.service');

async function listClasses(req, res, next) {
  try {
    res.json(await service.listClasses({ user: req.user, centerId: req.params.center_id, query: req.query }));
  } catch (err) {
    next(err);
  }
}

async function getClass(req, res, next) {
  try {
    res.json(await service.getClass({ user: req.user, classId: req.params.class_id }));
  } catch (err) {
    next(err);
  }
}

async function createClass(req, res, next) {
  try {
    res.status(201).json(await service.createClass({ user: req.user, centerId: req.params.center_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function updateClass(req, res, next) {
  try {
    res.json(await service.updateClass({ user: req.user, classId: req.params.class_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function listTeachers(req, res, next) {
  try {
    res.json(await service.listTeachers({ user: req.user, classId: req.params.class_id }));
  } catch (err) {
    next(err);
  }
}

async function assignTeacher(req, res, next) {
  try {
    res.status(201).json(await service.assignTeacher({ user: req.user, classId: req.params.class_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function removeTeacher(req, res, next) {
  try {
    await service.removeTeacher({ user: req.user, classId: req.params.class_id, classTeacherId: req.params.teacher_id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function listCriteria(req, res, next) {
  try {
    res.json(await service.listCriteria({ user: req.user, classId: req.params.class_id }));
  } catch (err) {
    next(err);
  }
}

async function createCriteria(req, res, next) {
  try {
    res.status(201).json(await service.createCriteria({ user: req.user, classId: req.params.class_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function updateCriteria(req, res, next) {
  try {
    res.json(await service.updateCriteria({ user: req.user, classId: req.params.class_id, criteriaId: req.params.criteria_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function deleteCriteria(req, res, next) {
  try {
    res.json(await service.deleteCriteria({ user: req.user, classId: req.params.class_id, criteriaId: req.params.criteria_id }));
  } catch (err) {
    next(err);
  }
}

async function listSchedules(req, res, next) {
  try {
    res.json(await service.listSchedules({ user: req.user, classId: req.params.class_id }));
  } catch (err) {
    next(err);
  }
}

async function createSchedule(req, res, next) {
  try {
    res.status(201).json(await service.createSchedule({ user: req.user, classId: req.params.class_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function deleteSchedule(req, res, next) {
  try {
    await service.deleteSchedule({ user: req.user, classId: req.params.class_id, scheduleId: req.params.schedule_id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}


module.exports = {
  listClasses,
  getClass,
  createClass,
  updateClass,
  listTeachers,
  assignTeacher,
  removeTeacher,
  listCriteria,
  createCriteria,
  updateCriteria,
  deleteCriteria,
  listSchedules,
  createSchedule,
  deleteSchedule
};
