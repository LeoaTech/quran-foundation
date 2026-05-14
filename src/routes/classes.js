const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/classes.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createClassSchema = z.object({
  name:            z.string().min(1, 'name is required'),
  name_ur:         z.string().optional(),
  course_id:       z.string().uuid('course_id must be a UUID'),
  course_level_id: z.string().uuid('course_level_id must be a UUID').optional(),
  max_capacity:    z.number().int().positive().optional(),
  schedule_days:   z.string().optional(),
  start_time:      z.string().regex(/^\d{2}:\d{2}$/, 'start_time must be HH:MM').optional(),
});

const updateClassSchema = z.object({
  name:            z.string().min(1).optional(),
  name_ur:         z.string().optional(),
  course_level_id: z.string().uuid().optional(),
  max_capacity:    z.number().int().positive().optional(),
  schedule_days:   z.string().optional(),
  start_time:      z.string().regex(/^\d{2}:\d{2}$/).optional(),
  is_active:       z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const assignTeacherSchema = z.object({
  teacher_user_id: z.string().uuid('teacher_user_id must be a UUID'),
  is_primary:      z.boolean().optional(),
  assigned_from:   z.string().date('assigned_from must be YYYY-MM-DD').optional(),
});

const createCriteriaSchema = z.object({
  label:         z.string().min(1, 'label is required'),
  label_ur:      z.string().optional(),
  topic_id:      z.string().uuid().optional(),
  subtopic_id:   z.string().uuid().optional(),
  max_marks:     z.number().int().positive('max_marks must be a positive integer'),
  display_order: z.number().int().min(0).optional(),
});

const updateCriteriaSchema = z.object({
  label:         z.string().min(1).optional(),
  label_ur:      z.string().optional(),
  topic_id:      z.string().uuid().optional(),
  subtopic_id:   z.string().uuid().optional(),
  max_marks:     z.number().int().positive().optional(),
  display_order: z.number().int().min(0).optional(),
  is_active:     z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.get(
  '/centers/:center_id/classes',
  requireAuth,
  requirePermission('classes.view'),
  controller.listClasses,
);

router.post(
  '/centers/:center_id/classes',
  requireAuth,
  requirePermission('classes.create'),
  validate(createClassSchema),
  controller.createClass,
);

router.get(
  '/classes/:class_id',
  requireAuth,
  requirePermission('classes.view'),
  controller.getClass,
);

router.patch(
  '/classes/:class_id',
  requireAuth,
  requirePermission('classes.edit'),
  validate(updateClassSchema),
  controller.updateClass,
);

// Teachers
router.get(
  '/classes/:class_id/teachers',
  requireAuth,
  requirePermission('classes.view'),
  controller.listTeachers,
);

router.post(
  '/classes/:class_id/teachers',
  requireAuth,
  requirePermission('classes.edit'),
  validate(assignTeacherSchema),
  controller.assignTeacher,
);

router.delete(
  '/classes/:class_id/teachers/:teacher_id',
  requireAuth,
  requirePermission('classes.edit'),
  controller.removeTeacher,
);

// Homework criteria
router.get(
  '/classes/:class_id/homework-criteria',
  requireAuth,
  requirePermission('homework_criteria.view'),
  controller.listCriteria,
);

router.post(
  '/classes/:class_id/homework-criteria',
  requireAuth,
  requirePermission('homework_criteria.create'),
  validate(createCriteriaSchema),
  controller.createCriteria,
);

router.patch(
  '/classes/:class_id/homework-criteria/:criteria_id',
  requireAuth,
  requirePermission('homework_criteria.edit'),
  validate(updateCriteriaSchema),
  controller.updateCriteria,
);

// Soft delete only — sets is_active=false
router.delete(
  '/classes/:class_id/homework-criteria/:criteria_id',
  requireAuth,
  requirePermission('homework_criteria.deactivate'),
  controller.deleteCriteria,
);

module.exports = router;
