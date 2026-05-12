const service = require('../services/centers.service');

async function getOrg(req, res, next) {
  try {
    res.json(await service.getOrg());
  } catch (err) {
    next(err);
  }
}

async function listCenters(req, res, next) {
  try {
    res.json(await service.listCenters({ query: req.query }));
  } catch (err) {
    next(err);
  }
}

async function getCenter(req, res, next) {
  try {
    res.json(await service.getCenter({ user: req.user, centerId: req.params.center_id }));
  } catch (err) {
    next(err);
  }
}

async function createCenter(req, res, next) {
  try {
    res.status(201).json(await service.createCenter({ user: req.user, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function updateCenter(req, res, next) {
  try {
    res.json(await service.updateCenter({ user: req.user, centerId: req.params.center_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function listClassrooms(req, res, next) {
  try {
    res.json(await service.listClassrooms({ user: req.user, centerId: req.params.center_id, query: req.query }));
  } catch (err) {
    next(err);
  }
}

async function createClassroom(req, res, next) {
  try {
    res.status(201).json(await service.createClassroom({ user: req.user, centerId: req.params.center_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

module.exports = { getOrg, listCenters, getCenter, createCenter, updateCenter, listClassrooms, createClassroom };
