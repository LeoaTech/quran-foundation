const { Router } = require('express');
const { z }       = require('zod');
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate    = require('../middleware/validate');
const controller  = require('../controllers/homework.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  frequency:          z.enum(['daily', 'after_2_days', 'weekly', 'biweekly', 'monthly', 'custom']),
  total_assignments:  z.number().int().min(1).max(500),
  first_due_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  instructions:       z.string().max(2000).optional().nullable(),
});

const assignmentPatchSchema = z.object({
  title:        z.string().max(255).optional(),
  title_ur:     z.string().max(255).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  topic_ids:    z.array(z.string().uuid()).optional(),
  criteria_ids: z.array(z.string().uuid()).optional(),
  is_published: z.boolean().optional(),
  due_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
}).refine((b) => Object.keys(b).length > 0, { message: 'At least one field required.' });

const applyDatesSchema = z.object({
  first_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

const linkContentSchema = z.object({
  content_ids: z.array(z.string().uuid()),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET  /courses/:course_id/homework-schedule
router.get(
  '/courses/:course_id/homework-schedule',
  requireAuth,
  controller.getSchedule,
);

  // PUT  /courses/:course_id/homework-schedule  (super_admin only)
router.put(
  '/courses/:course_id/homework-schedule',
  requireAuth,
  requirePermission('courses.edit'),
  validate(scheduleSchema),
  controller.saveSchedule,
);


// PATCH /courses/:course_id/homework-assignments/:assignment_id (super_admin + center_manager)
router.patch(
  '/courses/:course_id/homework-assignments/:assignment_id',
  requireAuth,
  validate(assignmentPatchSchema),
  controller.updateAssignment,
);

// POST /courses/:course_id/homework-schedule/apply-dates (center_manager + super_admin)
router.post(
  '/courses/:course_id/homework-schedule/apply-dates',
  requireAuth,
  validate(applyDatesSchema),
  controller.applyScheduleDates,
);

// GET /courses/:course_id/homework-assignments/:assignment_id/content
router.get(
  '/courses/:course_id/homework-assignments/:assignment_id/content',
  requireAuth,
  controller.getAssignmentContent,
);

// PUT /courses/:course_id/homework-assignments/:assignment_id/content  (super_admin only)
router.put(
  '/courses/:course_id/homework-assignments/:assignment_id/content',
  requireAuth,
  requirePermission('courses.edit'),
  validate(linkContentSchema),
  controller.linkContentToAssignment,
);


// GET /homework-assignments/:assignment_id/grid
router.get(
  '/homework-assignments/:assignment_id/grid',
  requireAuth,
  controller.getHomeworkGridSheet,
);

// POST /homework-assignments/:assignment_id/grid-marks
router.post(
  '/homework-assignments/:assignment_id/grid-marks',
  requireAuth,
  controller.saveHomeworkGridMarks,
);
module.exports = router;

