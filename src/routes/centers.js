const { Router } = require('express');
const { z } = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
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

router.get(
  '/org',
  requireAuth,
  requirePermission('org.view'),
  controller.getOrg,
);

router.get(
  '/centers',
  requireAuth,
  requirePermission('centers.view'),
  controller.listCenters,
);

router.post(
  '/centers',
  requireAuth,
  requirePermission('centers.create'),
  validate(createCenterSchema),
  controller.createCenter,
);

router.get(
  '/centers/:center_id',
  requireAuth,
  requirePermission('centers.view'),
  controller.getCenter,
);

router.patch(
  '/centers/:center_id',
  requireAuth,
  requirePermission('centers.edit'),
  validate(updateCenterSchema),
  controller.updateCenter,
);

router.get(
  '/centers/:center_id/classrooms',
  requireAuth,
  controller.listClassrooms,
);

router.post(
  '/centers/:center_id/classrooms',
  requireAuth,
  requirePermission('centers.edit'),
  validate(createClassroomSchema),
  controller.createClassroom,
);

module.exports = router;
