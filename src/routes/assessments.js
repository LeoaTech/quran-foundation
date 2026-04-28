const { Router } = require('express');
const { z }        = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
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

// Each result must carry exactly one of score (written/topic_test) or
// oral_grade (oral) — enforced here at the Zod layer and re-checked in
// the service once the assessment type is known.
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

// Create an assessment for a class.
router.post(
  '/classes/:class_id/assessments',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(createAssessmentSchema),
  controller.createAssessment,
);

// List all assessments for a class.
// ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
router.get(
  '/classes/:class_id/assessments',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.listAssessmentsByClass,
);

// Get a single assessment by ID.
router.get(
  '/assessments/:assessment_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.getAssessment,
);

// Bulk-insert results for an assessment (single transaction).
router.post(
  '/assessments/:assessment_id/results',
  requireAuth,
  requireRoles('teacher', 'center_manager'),
  validate(createResultsSchema),
  controller.createResults,
);

// List all results for an assessment.
router.get(
  '/assessments/:assessment_id/results',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.listResults,
);

// Update a single result (correct score, oral_grade, remarks, etc.).
router.patch(
  '/assessments/:assessment_id/results/:result_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  validate(updateResultSchema),
  controller.updateResult,
);

// Get a student's full assessment history.
// ?class_id=uuid  ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
router.get(
  '/students/:user_id/assessments',
  requireAuth,
  controller.listStudentAssessments,
);

module.exports = router;
