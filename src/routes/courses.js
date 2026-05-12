const { Router } = require('express');
const { z }        = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
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
  title:           z.string().min(1, 'title is required'),
  title_ur:        z.string().optional(),
  description_ur:  z.string().optional(),
  level_order:     z.number().int().min(0).optional(),
  duration_months: z.number().int().min(1).optional(),
});

const updateLevelSchema = z.object({
  title:           z.string().min(1).optional(),
  title_ur:        z.string().optional(),
  description_ur:  z.string().optional(),
  level_order:     z.number().int().min(0).optional(),
  duration_months: z.number().int().min(1).nullable().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const upsertFeeSchema = z.object({
  full_fee: z.number().positive('full_fee must be a positive number'),
  currency: z.string().length(3).optional().default('PKR'),
  notes:    z.string().optional(),
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

// ── Courses ───────────────────────────────────────────────────────────────────

router.get(
  '/courses',
  requireAuth,
  controller.listCourses,
);

router.post(
  '/courses',
  requireAuth,
  requireRoles('super_admin'),
  validate(createCourseSchema),
  controller.createCourse,
);

router.get(
  '/courses/:course_id',
  requireAuth,
  controller.getCourse,
);

router.patch(
  '/courses/:course_id',
  requireAuth,
  requireRoles('super_admin'),
  validate(updateCourseSchema),
  controller.updateCourse,
);

// ── Course Levels ──────────────────────────────────────────────────────────────

router.get(
  '/courses/:course_id/levels',
  requireAuth,
  controller.getLevels,
);

router.post(
  '/courses/:course_id/levels',
  requireAuth,
  requireRoles('super_admin'),
  validate(createLevelSchema),
  controller.createLevel,
);

router.patch(
  '/courses/:course_id/levels/:level_id',
  requireAuth,
  requireRoles('super_admin'),
  validate(updateLevelSchema),
  controller.updateLevel,
);

// ── Course Level Fees ──────────────────────────────────────────────────────────

router.get(
  '/courses/:course_id/fees',
  requireAuth,
  controller.getCourseFees,
);

router.put(
  '/courses/:course_id/levels/:level_id/fee',
  requireAuth,
  requireRoles('super_admin'),
  validate(upsertFeeSchema),
  controller.upsertCourseLevelFee,
);

router.delete(
  '/courses/:course_id/levels/:level_id/fee',
  requireAuth,
  requireRoles('super_admin'),
  controller.deleteCourseLevelFee,
);

// ── Topics ────────────────────────────────────────────────────────────────────

router.get(
  '/courses/:course_id/topics',
  requireAuth,
  controller.getTopics,
);

router.post(
  '/courses/:course_id/topics',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(createTopicSchema),
  controller.createTopic,
);

router.patch(
  '/courses/:course_id/topics/:topic_id',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(updateTopicSchema),
  controller.updateTopic,
);

router.delete(
  '/courses/:course_id/topics/:topic_id',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  controller.deleteTopic,
);

// ── Subtopics ─────────────────────────────────────────────────────────────────

router.post(
  '/courses/:course_id/topics/:topic_id/subtopics',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(createSubtopicSchema),
  controller.createSubtopic,
);

router.patch(
  '/courses/:course_id/topics/:topic_id/subtopics/:subtopic_id',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(updateSubtopicSchema),
  controller.updateSubtopic,
);

router.delete(
  '/courses/:course_id/topics/:topic_id/subtopics/:subtopic_id',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  controller.deleteSubtopic,
);

module.exports = router;
