const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/enrollments.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createEnrollmentSchema = z.object({
  student_user_id: z.string().uuid('student_user_id must be a UUID'),
  class_id:        z.string().uuid('class_id must be a UUID'),
  enrolled_on:     z.string().date('enrolled_on must be YYYY-MM-DD').optional(),
  prior_level:     z.string().max(100).optional(),
  notes_ur:        z.string().optional(),
});

const updateEnrollmentSchema = z.object({
  status:       z.enum(['active', 'withdrawn']).optional(),
  withdrawn_on: z.string().date('withdrawn_on must be YYYY-MM-DD').optional(),
  prior_level:  z.string().max(100).optional(),
  notes_ur:     z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post(
  '/enrollments',
  requireAuth,
  requirePermission('enrollments.create'),
  validate(createEnrollmentSchema),
  controller.createEnrollment,
);

router.get(
  '/classes/:class_id/enrollments',
  requireAuth,
  requirePermission('enrollments.view'),
  controller.listEnrollmentsByClass,
);

// Any authenticated user can view a student's enrollment history
router.get(
  '/students/:user_id/enrollments',
  requireAuth,
  controller.listEnrollmentsByStudent,
);

router.patch(
  '/enrollments/:enrollment_id',
  requireAuth,
  requireAnyPermission('enrollments.withdraw', 'enrollments.transfer'),
  validate(updateEnrollmentSchema),
  controller.updateEnrollment,
);

module.exports = router;
