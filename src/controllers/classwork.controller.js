const service = require("../services/classwork.service");

// ── Content ────────────────────────────────────────────────────────────────────

async function listContent(req, res, next) {
  try {
    res.json(
      await service.listContent({
        courseId: req.params.course_id,
        query: req.query,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function createContent(req, res, next) {
  try {
    res.status(201).json(
      await service.createContent({
        user: req.user,
        courseId: req.params.course_id,
        body: req.body,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function updateContent(req, res, next) {
  try {
    res.json(
      await service.updateContent({
        user: req.user,
        courseId: req.params.course_id,
        contentId: req.params.content_id,
        body: req.body,
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listContent,
  createContent,
  updateContent
};
