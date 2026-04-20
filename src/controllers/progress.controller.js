const progressService = require('../services/progress.service');

async function createProgressSession(req, res, next) {
  try {
    const result = await progressService.createProgressSession({
      teacherUserId: req.user.id,
      body: req.body,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createProgressSession };
