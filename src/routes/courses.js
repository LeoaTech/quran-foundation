const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/courses.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const COURSE_TYPES = ['hifz', 'nazra', 'tajweed', 'arabic'];

const createCourseSchema = z.object({
  name:           z.string().min(1, 'name is required'),
  name_ur:        z.string().optional(),
  name_ar:        z.string().optional(),
  type:           z.enum(COURSE_TYPES, {
    errorMap: () => ({ message: `type must be one of: ${COURSE_TYPES.join(', ')}` }),
  }).optional(),
  description_ur: z.string().optional(),
});

const updateCourseSchema = z.object({
  name:           z.string().min(1).optional(),
  name_ur:        z.string().optional(),
  name_ar:        z.string().optional(),
  type:           z.enum(COURSE_TYPES).optional(),
  description_ur: z.string().optional(),
  is_active:      z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const createLevelSchema = z.object({
  title:          z.string().min(1, 'title is required'),
  title_ur:       z.string().optional(),
  description_ur: z.string().optional(),
  level_order:    z.number().int().min(0).optional(),
});

const createTopicSchema = z.object({
  title:          z.string().min(1, 'title is required'),
  title_ur:       z.string().optional(),
  title_ar:       z.string().optional(),
  description_ur: z.string().optional(),
  display_order:  z.number().int().min(0).optional(),
});

const updateTopicSchema = z.object({
  title:          z.string().min(1).optional(),
  title_ur:       z.string().optional(),
  title_ar:       z.string().optional(),
  description_ur: z.string().optional(),
  display_order:  z.number().int().min(0).optional(),
  is_active:      z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const createSubtopicSchema = z.object({
  title:         z.string().min(1, 'title is required'),
  title_ur:      z.string().optional(),
  title_ar:      z.string().optional(),
  display_order: z.number().int().min(0).optional(),
});

const updateSubtopicSchema = z.object({
  title:         z.string().min(1).optional(),
  title_ur:      z.string().optional(),
  title_ar:      z.string().optional(),
  display_order: z.number().int().min(0).optional(),
  is_active:     z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Courses — any authenticated user can browse the catalogue
router.get('/courses',             requireAuth, controller.listCourses);
router.get('/courses/:course_id',  requireAuth, controller.getCourse);

router.post(
  '/courses',
  requireAuth,
  requirePermission('courses.create'),
  validate(createCourseSchema),
  controller.createCourse,
);

router.patch(
  '/courses/:course_id',
  requireAuth,
  requirePermission('courses.edit'),
  validate(updateCourseSchema),
  controller.updateCourse,
);

// Course levels
router.post(
  '/courses/:course_id/levels',
  requireAuth,
  requirePermission('courses.create'),
  validate(createLevelSchema),
  controller.createLevel,
);

// Topics — any authenticated user can read
router.get('/courses/:course_id/topics', requireAuth, controller.getTopics);

router.post(
  '/courses/:course_id/topics',
  requireAuth,
  requirePermission('topics.create'),
  validate(createTopicSchema),
  controller.createTopic,
);

router.patch(
  '/courses/:course_id/topics/:topic_id',
  requireAuth,
  requirePermission('topics.edit'),
  validate(updateTopicSchema),
  controller.updateTopic,
);

router.delete(
  '/courses/:course_id/topics/:topic_id',
  requireAuth,
  requirePermission('topics.delete'),
  controller.deleteTopic,
);

// Subtopics
router.post(
  '/courses/:course_id/topics/:topic_id/subtopics',
  requireAuth,
  requirePermission('topics.create'),
  validate(createSubtopicSchema),
  controller.createSubtopic,
);

router.patch(
  '/courses/:course_id/topics/:topic_id/subtopics/:subtopic_id',
  requireAuth,
  requirePermission('topics.edit'),
  validate(updateSubtopicSchema),
  controller.updateSubtopic,
);

router.delete(
  '/courses/:course_id/topics/:topic_id/subtopics/:subtopic_id',
  requireAuth,
  requirePermission('topics.delete'),
  controller.deleteSubtopic,
);

module.exports = router;
