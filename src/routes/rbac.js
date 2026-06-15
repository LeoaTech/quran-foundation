const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/rbac.controller');

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex (e.g. #1D9E75)').optional();
const SNAKE_CASE = z.string().regex(/^[a-z][a-z0-9_]*$/, 'name must be snake_case (lowercase letters, digits, underscores)');

const createRoleSchema = z.object({
  name:        SNAKE_CASE,
  description: z.string().optional(),
  label_ur:    z.string().optional(),
  color:       HEX_COLOR,
});

const updateRoleSchema = z.object({
  description: z.string().optional(),
  label_ur:    z.string().optional(),
  color:       HEX_COLOR,
  is_active:   z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, { message: 'Request body must contain at least one field.' });

const setPermissionsSchema = z.object({
  permission_ids: z.array(z.string().uuid('permission_ids must contain valid UUIDs')),
});

const togglePermissionSchema = z.object({
  is_granted: z.boolean(),
});

const createPermissionSchema = z.object({
  key:         z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'key must match {module}.{action} — e.g. "centers.create"'),
  label:       z.string().min(1, 'label is required'),
  label_ur:    z.string().optional(),
  module:      z.string().min(1, 'module is required'),
  action:      z.string().min(1, 'action is required'),
  description: z.string().optional(),
});

const updatePermissionSchema = z.object({
  label:       z.string().min(1).optional(),
  label_ur:    z.string().optional(),
  description: z.string().optional(),
  is_active:   z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, { message: 'Request body must contain at least one field.' });

const userPermissionOverrideSchema = z.object({
  permission_id: z.string().uuid('permission_id must be a valid UUID'),
  is_granted:    z.boolean(),
});

// ── Role routes ───────────────────────────────────────────────────────────────

// GET /rbac/roles?include=permissions
router.get(
  '/rbac/roles',
  requireAuth,
  requirePermission('roles.view'),
  controller.listRoles,
);

// POST /rbac/roles
router.post(
  '/rbac/roles',
  requireAuth,
  requirePermission('roles.create'),
  validate(createRoleSchema),
  controller.createRole,
);

// GET /rbac/roles/:roleId
router.get(
  '/rbac/roles/:roleId',
  requireAuth,
  requirePermission('roles.view'),
  controller.getRole,
);

// PATCH /rbac/roles/:roleId
router.patch(
  '/rbac/roles/:roleId',
  requireAuth,
  requirePermission('roles.edit'),
  validate(updateRoleSchema),
  controller.updateRole,
);

// DELETE /rbac/roles/:roleId
router.delete(
  '/rbac/roles/:roleId',
  requireAuth,
  requirePermission('roles.delete'),
  controller.deleteRole,
);

// GET /rbac/roles/:roleId/permissions
// Returns all permissions with is_granted flag for this role
router.get(
  '/rbac/roles/:roleId/permissions',
  requireAuth,
  requirePermission('roles.view'),
  controller.getRolePermissions,
);

// PUT /rbac/roles/:roleId/permissions
// Full replace of this role's permission set
router.put(
  '/rbac/roles/:roleId/permissions',
  requireAuth,
  requirePermission('roles.edit'),
  validate(setPermissionsSchema),
  controller.setRolePermissions,
);

// PATCH /rbac/roles/:roleId/permissions/:permissionId
// Toggle a single permission on/off for this role
router.patch(
  '/rbac/roles/:roleId/permissions/:permissionId',
  requireAuth,
  requirePermission('roles.edit'),
  validate(togglePermissionSchema),
  controller.toggleRolePermission,
);

// ── Permission routes ─────────────────────────────────────────────────────────

// GET /rbac/permissions?module=centers&is_active=true
// Response grouped by module
router.get(
  '/rbac/permissions',
  requireAuth,
  requirePermission('permissions.view'),
  controller.listPermissions,
);

// POST /rbac/permissions
router.post(
  '/rbac/permissions',
  requireAuth,
  requirePermission('permissions.assign'),
  validate(createPermissionSchema),
  controller.createPermission,
);

// PATCH /rbac/permissions/:permissionId
// label, label_ur, description, is_active only — key/module/action immutable
router.patch(
  '/rbac/permissions/:permissionId',
  requireAuth,
  requirePermission('permissions.assign'),
  validate(updatePermissionSchema),
  controller.updatePermission,
);

// ── User permission overrides (mounted at /users to match RESTful path) ───────

// GET /users/:userId/permissions
router.get(
  '/users/:userId/permissions',
  requireAuth,
  async (req, res, next) => {
    if (req.user.id === req.params.userId) return next();
    return requirePermission('roles.assign')(req, res, next);
  },
  controller.getUserPermissions,
);

// POST /users/:userId/permissions
router.post(
  '/users/:userId/permissions',
  requireAuth,
  requirePermission('roles.assign'),
  validate(userPermissionOverrideSchema),
  controller.setUserPermissionOverride,
);

// DELETE /users/:userId/permissions/:permissionId
router.delete(
  '/users/:userId/permissions/:permissionId',
  requireAuth,
  requirePermission('roles.assign'),
  controller.removeUserPermissionOverride,
);

module.exports = router;
