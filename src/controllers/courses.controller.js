const service = require('../services/courses.service');

async function listCourses(req, res, next) {
  try {
    res.json(await service.listCourses({ query: req.query }));
  } catch (err) {
    next(err);
  }
}

async function getCourse(req, res, next) {
  try {
    res.json(await service.getCourse({ courseId: req.params.course_id }));
  } catch (err) {
    next(err);
  }
}

async function createCourse(req, res, next) {
  try {
    res.status(201).json(await service.createCourse({ body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function updateCourse(req, res, next) {
  try {
    res.json(await service.updateCourse({ courseId: req.params.course_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function createLevel(req, res, next) {
  try {
    res.status(201).json(await service.createLevel({ courseId: req.params.course_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function getTopics(req, res, next) {
  try {
    res.json(await service.getTopics({ courseId: req.params.course_id }));
  } catch (err) {
    next(err);
  }
}

async function createTopic(req, res, next) {
  try {
    res.status(201).json(await service.createTopic({ user: req.user, courseId: req.params.course_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function updateTopic(req, res, next) {
  try {
    res.json(await service.updateTopic({ courseId: req.params.course_id, topicId: req.params.topic_id, body: req.body }));
  } catch (err) {
    next(err);
  }
}

async function deleteTopic(req, res, next) {
  try {
    res.json(await service.deleteTopic({ courseId: req.params.course_id, topicId: req.params.topic_id }));
  } catch (err) {
    next(err);
  }
}

async function createSubtopic(req, res, next) {
  try {
    res.status(201).json(await service.createSubtopic({
      courseId:  req.params.course_id,
      topicId:   req.params.topic_id,
      body:      req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateSubtopic(req, res, next) {
  try {
    res.json(await service.updateSubtopic({
      courseId:   req.params.course_id,
      topicId:    req.params.topic_id,
      subtopicId: req.params.subtopic_id,
      body:       req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function deleteSubtopic(req, res, next) {
  try {
    res.json(await service.deleteSubtopic({
      courseId:   req.params.course_id,
      topicId:    req.params.topic_id,
      subtopicId: req.params.subtopic_id,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  createLevel,
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  createSubtopic,
  updateSubtopic,
  deleteSubtopic,
};
