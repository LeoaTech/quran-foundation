const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/attendance.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const attendanceRecordSchema = z.object({
  student_user_id: z.string().uuid('student_user_id must be a UUID'),
  status:          z.enum(['present', 'absent', 'late']),
  note_ur:         z.string().optional(),
});

const createSessionSchema = z.object({
  session_date: z.string().date('session_date must be YYYY-MM-DD'),
  records:      z.array(attendanceRecordSchema).min(1, 'At least one record is required'),
});

const correctRecordSchema = z.object({
  status:  z.enum(['present', 'absent', 'late']).optional(),
  note_ur: z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post(
  '/classes/:class_id/attendance',
  requireAuth,
  requirePermission('attendance.mark'),
  validate(createSessionSchema),
  controller.createAttendanceSession,
);

router.get(
  '/classes/:class_id/attendance',
  requireAuth,
  requirePermission('attendance.view'),
  controller.listSessionsByClass,
);

router.get(
  '/attendance/sessions/:session_id/records',
  requireAuth,
  requirePermission('attendance.view'),
  controller.getSessionRecords,
);

router.patch(
  '/attendance/sessions/:session_id/records/:record_id',
  requireAuth,
  requirePermission('attendance.correct'),
  validate(correctRecordSchema),
  controller.correctRecord,
);

// Any authenticated user can view a student's own attendance history
router.get(
  '/students/:user_id/attendance',
  requireAuth,
  controller.getStudentAttendance,
);

module.exports = router;
