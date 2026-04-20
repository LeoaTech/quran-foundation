const { Router } = require('express');
const { z } = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/progress.controller');

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────

const scoreSchema = z.object({
  criteria_id:    z.string().uuid('criteria_id must be a valid UUID'),
  marks_obtained: z.number().int().min(0, 'marks_obtained must be ≥ 0'),
  note_ur:        z.string().optional(),
});

const progressSessionSchema = z.object({
  enrollment_id: z.string().uuid('enrollment_id must be a valid UUID'),
  class_id:      z.string().uuid('class_id must be a valid UUID'),
  session_date:  z.string().date('session_date must be YYYY-MM-DD'),

  classwork: z.object({
    topic_id:    z.string().uuid().optional(),
    subtopic_id: z.string().uuid().optional(),
    grade:       z.enum(['excellent', 'good', 'average', 'revision']).optional(),
    note_ur:     z.string().optional(),
  }),

  homework: z.object({
    due_date:        z.string().date().optional(),
    overall_note_ur: z.string().optional(),
    scores: z
      .array(scoreSchema)
      .min(1, 'At least one homework score is required'),
  }),
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(progressSessionSchema),
  controller.createProgressSession,
);

module.exports = router;
