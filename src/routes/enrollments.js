const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const upload       = require('../middleware/upload');
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
// For minor students (is_minor: true), phone is omitted — guardian contact fields
// are provided instead. The backend will create/find the guardian user and link them.
const enrollNewStudentSchema = z.object({
  full_name:         z.string().min(1, 'full_name is required'),
  full_name_ur:      z.string().optional(),
  // Phone is optional at schema level; the .refine() below enforces it for adults.
  phone:             z.string().optional(),
  whatsapp:          z.string().optional(),
  date_of_birth:     z.string().date('date_of_birth must be YYYY-MM-DD').optional(),
  gender:            z.enum(['male', 'female', 'other']).optional(),
  // Minor-specific fields
  is_minor:          z.union([z.boolean(), z.string().transform(v => v === 'true' || v === 'yes')]).optional().default(false),
  guardian_name:     z.string().max(255).optional(),
  guardian_phone:    z.string().optional(),
  guardian_relation: z.string().max(50).optional(),
  class_id:          z.string().uuid('class_id must be a UUID'),
  class_schedule_id: z.string().uuid('class_schedule_id must be a UUID').optional().nullable(),
  enrolled_on:       z.string().date('enrolled_on must be YYYY-MM-DD').optional(),
  prior_level:       z.string().max(100).optional(),
  notes_ur:          z.string().optional(),
  amount_paid:       z.coerce.number().positive().optional(),
  payment_method:    z.string().optional(),
  qualification:     z.string().max(100).optional(),
  occupation:        z.string().max(100).optional(),
  marital_status:    z.string().max(50).optional(),
  is_repeater:       z.string().optional().transform(v => v === 'true' || v === 'yes' || v === 'on'),
  address:           z.string().optional(),
  center_manager_name: z.string().max(255).optional(),
  center_manager_contact: z.string().max(50).optional(),
}).refine(
  (data) => data.is_minor || (!!data.phone && data.phone.trim().length > 0),
  { message: 'phone is required for adult students', path: ['phone'] },
).refine(
  (data) => !data.is_minor || (!!data.guardian_phone && data.guardian_phone.trim().length > 0),
  { message: 'guardian_phone is required for minor students', path: ['guardian_phone'] },
);

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
  upload.single('profile_picture'),
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
