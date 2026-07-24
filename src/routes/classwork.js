const { Router } = require('express');
const { z }       = require('zod');
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate    = require('../middleware/validate');
const controller  = require('../controllers/classwork.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const wordSchema = z.object({
  word_text:      z.string().min(1, 'word_text is required'),
  sequence_order: z.number().int().min(1).optional(),
  topic_ids:      z.array(z.string().uuid()).optional().default([]),
  rule_details:   z.array(z.object({
    subtopic_id:      z.string().uuid(),
    marks_per_rule:   z.number().int().min(0).optional().default(1),
    occurrence_count: z.number().int().min(1).optional().default(1),
  })).optional().default([]),
  note:           z.string().max(2000).optional().nullable(),
});

const createContentSchema = z.object({
  course_level_id: z.string().uuid().optional().nullable(),
  topic_id:        z.string().uuid().optional().nullable(),
  surah_number:    z.number().int().min(1).max(114).optional().nullable(),
  ayah_number:     z.number().int().min(1).optional().nullable(),
  arabic_text:     z.string().min(1, 'arabic_text is required'),
  label:           z.string().max(255).optional().nullable(),
  rule_marks:      z.record(z.string(), z.number()).optional().default({}),
  words:           z.array(wordSchema).optional().default([]),
});

router.post(
  '/courses/:course_id/classwork-content',
  requireAuth,
  requirePermission('courses.edit'),
  validate(createContentSchema),
  controller.createContent,
);
module.exports = router;
