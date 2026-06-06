const { Router } = require('express');
const { z } = require('zod');
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const controller = require('../controllers/teacherTopics.controller');

const router = Router();

const createAssignmentSchema = z.object({
  teacher_user_id: z.string().uuid('teacher_user_id must be a UUID'),
  topic_id: z.string().uuid('topic_id must be a UUID'),
});

router.get(
  '/centers/:center_id/teacher-topics',
  requireAuth,
  requirePermission('classes.view'), // teachers can be viewed if you have class permissions
  controller.listTeacherTopics
);

router.post(
  '/centers/:center_id/teacher-topics',
  requireAuth,
  requirePermission('classes.edit'), // permissions aligned with class editing
  validate(createAssignmentSchema),
  controller.createAssignment
);

router.put(
  '/centers/:center_id/teacher-topics/:assignment_id',
  requireAuth,
  requirePermission('classes.edit'),
  validate(createAssignmentSchema),
  controller.updateAssignment
);

router.delete(
  '/centers/:center_id/teacher-topics/:assignment_id',
  requireAuth,
  requirePermission('classes.edit'),
  controller.deleteAssignment
);

module.exports = router;
