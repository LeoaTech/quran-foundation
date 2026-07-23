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
}).refine((b) => Object.keys(b).length > 0, { message: 'At least one field required.' });

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


module.exports = router;
