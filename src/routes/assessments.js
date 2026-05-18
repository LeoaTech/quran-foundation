const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/assessments.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createAssessmentSchema = z.object({
  title:           z.string().min(1, 'title is required'),
  title_ur:        z.string().optional(),
  type:            z.enum(['written', 'oral', 'topic_test']).optional(),
  assessment_date: z.string().date('assessment_date must be YYYY-MM-DD').optional(),
  max_score:       z.number().int().min(0).optional(),
  instructions_ur: z.string().optional(),
});

const resultItemSchema = z.object({
  student_user_id:    z.string().uuid('student_user_id must be a valid UUID'),
  examiner_user_id:   z.string().uuid('examiner_user_id must be a valid UUID').optional(),
  score:              z.number().int().min(0).optional(),
  oral_grade:         z.enum(['excellent', 'good', 'average', 'fail']).optional(),
  topic_tested_id:    z.string().uuid().optional(),
  subtopic_tested_id: z.string().uuid().optional(),
  remarks_ur:         z.string().optional(),
  remarks_ar:         z.string().optional(),
}).refine(
  (r) => (r.score !== undefined) !== (r.oral_grade !== undefined),
  { message: 'Exactly one of score or oral_grade must be provided per result.' },
);

const createResultsSchema = z.object({
  results: z.array(resultItemSchema).min(1, 'At least one result is required'),
});

const updateResultSchema = z.object({
  score:              z.number().int().min(0).optional(),
  oral_grade:         z.enum(['excellent', 'good', 'average', 'fail']).optional(),
  topic_tested_id:    z.string().uuid().optional(),
  subtopic_tested_id: z.string().uuid().optional(),
  remarks_ur:         z.string().optional(),
  remarks_ar:         z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post(
  '/classes/:class_id/assessments',
  requireAuth,
  requirePermission('assessments.create'),
  validate(createAssessmentSchema),
  controller.createAssessment,
);

router.get(
  '/classes/:class_id/assessments',
  requireAuth,
  requirePermission('assessments.view'),
  controller.listAssessmentsByClass,
);

router.get(
  '/assessments/:assessment_id',
  requireAuth,
  requirePermission('assessments.view'),
  controller.getAssessment,
);

router.post(
  '/assessments/:assessment_id/results',
  requireAuth,
  requirePermission('assessments.record_results'),
  validate(createResultsSchema),
  controller.createResults,
);

router.get(
  '/assessments/:assessment_id/results',
  requireAuth,
  requirePermission('assessments.view'),
  controller.listResults,
);

router.patch(
  '/assessments/:assessment_id/results/:result_id',
  requireAuth,
  requirePermission('assessments.record_results'),
  validate(updateResultSchema),
  controller.updateResult,
);

// Any authenticated user can view a student's assessment history
router.get(
  '/students/:user_id/assessments',
  requireAuth,
  controller.listStudentAssessments,
);

module.exports = router;
