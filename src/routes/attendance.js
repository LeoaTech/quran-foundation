const { Router } = require('express');
const { z }        = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
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

// Create a session and bulk-mark attendance for all students.
router.post(
  '/classes/:class_id/attendance',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  validate(createSessionSchema),
  controller.createAttendanceSession,
);

// List attendance sessions for a class with optional date-range filter.
router.get(
  '/classes/:class_id/attendance',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.listSessionsByClass,
);

// Correct a single attendance record (logs corrected_by + corrected_at).
router.patch(
  '/attendance/sessions/:session_id/records/:record_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  validate(correctRecordSchema),
  controller.correctRecord,
);

// Get a student's full attendance history with summary stats.
router.get(
  '/students/:user_id/attendance',
  requireAuth,
  controller.getStudentAttendance,
);

module.exports = router;
