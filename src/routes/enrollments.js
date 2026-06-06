const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/enrollments.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createEnrollmentSchema = z.object({
  student_user_id:   z.string().uuid('student_user_id must be a UUID'),
  class_id:          z.string().uuid('class_id must be a UUID'),
  class_schedule_id: z.string().uuid('class_schedule_id must be a UUID').optional().nullable(),
  enrolled_on:       z.string().date('enrolled_on must be YYYY-MM-DD').optional(),
  prior_level:       z.string().max(100).optional(),
  notes_ur:          z.string().optional(),
  amount_paid:       z.number().positive().optional(),
  payment_method:    z.string().optional(),
});

const updateEnrollmentSchema = z.object({
  status:       z.enum(['active', 'withdrawn']).optional(),
  withdrawn_on: z.string().date('withdrawn_on must be YYYY-MM-DD').optional(),
  prior_level:  z.string().max(100).optional(),
  notes_ur:     z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// Enroll a NEW student — creates user + role + enrollment in one transaction.
const enrollNewStudentSchema = z.object({
  full_name:         z.string().min(1, 'full_name is required'),
  full_name_ur:      z.string().optional(),
  phone:             z.string().min(1, 'phone is required'),
  whatsapp:          z.string().optional(),
  date_of_birth:     z.string().date('date_of_birth must be YYYY-MM-DD').optional(),
  gender:            z.enum(['male', 'female', 'other']).optional(),
  class_id:          z.string().uuid('class_id must be a UUID'),
  class_schedule_id: z.string().uuid('class_schedule_id must be a UUID').optional().nullable(),
  enrolled_on:       z.string().date('enrolled_on must be YYYY-MM-DD').optional(),
  prior_level:       z.string().max(100).optional(),
  notes_ur:          z.string().optional(),
  amount_paid:       z.number().positive().optional(),
  payment_method:    z.string().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Enroll an existing student into a class.
router.post(
  '/enrollments',
  requireAuth,
  requirePermission('enrollments.create'),
  validate(createEnrollmentSchema),
  controller.createEnrollment,
);

// Enroll a brand-new student — register + enroll in one step.
router.post(
  '/enrollments/enroll-student',
  requireAuth,
  requirePermission('enrollments.create'),
  validate(enrollNewStudentSchema),
  controller.enrollNewStudent,
);

// List all enrollments for a center.
router.get(
  '/centers/:center_id/enrollments',
  requireAuth,
  requirePermission('enrollments.view'),
  controller.listEnrollmentsByCenter,
);

// List all enrollments for a class (?status=active|withdrawn).
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
