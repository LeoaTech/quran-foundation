const { Router } = require('express');
const { z } = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/centers.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createCenterSchema = z.object({
  name:       z.string().min(1, 'name is required'),
  name_ur:    z.string().optional(),
  address:    z.string().optional(),
  address_ur: z.string().optional(),
  city:       z.string().optional(),
  phone:      z.string().optional(),
});

// PATCH accepts any subset of the same fields plus is_active for soft-deactivation.
const updateCenterSchema = z.object({
  name:       z.string().min(1).optional(),
  name_ur:    z.string().optional(),
  address:    z.string().optional(),
  address_ur: z.string().optional(),
  city:       z.string().optional(),
  phone:      z.string().optional(),
  is_active:  z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const createClassroomSchema = z.object({
  name:         z.string().min(1, 'name is required'),
  name_ur:      z.string().optional(),
  capacity:     z.number().int().positive().optional(),
  session_name: z.string().optional(),
  session_date: z.string().date('session_date must be YYYY-MM-DD').optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Organization
router.get(
  '/org',
  requireAuth,
  requireRoles('super_admin'),
  controller.getOrg,
);

// Centers list + create (super_admin only)
router.get(
  '/centers',
  requireAuth,
  requireRoles('super_admin'),
  controller.listCenters,
);

router.post(
  '/centers',
  requireAuth,
  requireRoles('super_admin'),
  validate(createCenterSchema),
  controller.createCenter,
);

// Single center — super_admin or center_manager of that center
router.get(
  '/centers/:center_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  controller.getCenter,
);

router.patch(
  '/centers/:center_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  validate(updateCenterSchema),
  controller.updateCenter,
);

// Classrooms — manager/teacher of that center; create is manager-only
router.get(
  '/centers/:center_id/classrooms',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.listClassrooms,
);

router.post(
  '/centers/:center_id/classrooms',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  validate(createClassroomSchema),
  controller.createClassroom,
);

module.exports = router;
