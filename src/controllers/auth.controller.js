const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    res.json(await authService.login(req.body));
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    res.json(await authService.refresh(req.body));
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.body);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword({ userId: req.user.id, ...req.body });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, changePassword };
