const { Router } = require('express');
const { z }        = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/progress.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const scoreSchema = z.object({
  criteria_id:    z.string().uuid('criteria_id must be a valid UUID'),
  marks_obtained: z.number().int().min(0, 'marks_obtained must be ≥ 0'),
  note_ur:        z.string().optional(),
});

const createProgressSessionSchema = z.object({
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
    scores: z.array(scoreSchema).min(1, 'At least one homework score is required'),
  }),
});

const updateProgressSessionSchema = z.object({
  cw_topic_id:    z.string().uuid().optional(),
  cw_subtopic_id: z.string().uuid().optional(),
  cw_grade:       z.enum(['excellent', 'good', 'average', 'revision']).optional(),
  cw_note_ur:     z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const updateHomeworkEntrySchema = z.object({
  is_submitted:    z.boolean().optional(),
  due_date:        z.string().date('due_date must be YYYY-MM-DD').optional(),
  overall_note_ur: z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const updateHomeworkScoreSchema = z.object({
  marks_obtained: z.number().int().min(0).optional(),
  note_ur:        z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Log a classwork + homework session.
router.post(
  '/progress-sessions',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(createProgressSessionSchema),
  controller.createProgressSession,
);

// Get a single session with full homework entry and scores.
router.get(
  '/progress-sessions/:session_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.getProgressSession,
);

// Correct classwork fields on an existing session.
router.patch(
  '/progress-sessions/:session_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  validate(updateProgressSessionSchema),
  controller.updateProgressSession,
);

// Get a student's full progress history. Optionally include homework scores.
// ?class_id=uuid  ?from=YYYY-MM-DD  ?to=YYYY-MM-DD  ?include=homework_scores
router.get(
  '/students/:user_id/progress',
  requireAuth,
  controller.getStudentProgress,
);

// Update submission status or overall note on a homework entry.
router.patch(
  '/homework-entries/:entry_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  validate(updateHomeworkEntrySchema),
  controller.updateHomeworkEntry,
);

// Correct a single homework score (re-validates against max_marks).
router.patch(
  '/homework-entries/:entry_id/scores/:score_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  validate(updateHomeworkScoreSchema),
  controller.updateHomeworkScore,
);

module.exports = router;
