const { Router } = require('express');
const { z }        = require('zod');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const controller   = require('../controllers/users.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const ROLES = ['super_admin', 'center_manager', 'finance_manager', 'teacher', 'student', 'guardian'];
const GENDERS = ['male', 'female', 'other'];
const LANGS = ['en', 'ur', 'ar'];

const createUserSchema = z.object({
  full_name:      z.string().min(1, 'full_name is required'),
  full_name_ur:   z.string().optional(),
  phone:          z.string().min(1, 'phone is required'),
  whatsapp:       z.string().optional(),
  email:          z.string().email().optional(),
  date_of_birth:  z.string().date('date_of_birth must be YYYY-MM-DD').optional(),
  gender:         z.enum(GENDERS).optional(),
  preferred_lang: z.enum(LANGS).optional(),
  role:           z.enum(ROLES, { errorMap: () => ({ message: `role must be one of: ${ROLES.join(', ')}` }) }),
  center_id:      z.string().uuid('center_id must be a UUID').optional(),
  base_salary:    z.number().min(0).optional(),
});

const updateUserSchema = z.object({
  full_name:      z.string().min(1).optional(),
  full_name_ur:   z.string().optional(),
  phone:          z.string().optional(),
  whatsapp:       z.string().optional(),
  email:          z.string().email().optional(),
  date_of_birth:  z.string().date().optional(),
  gender:         z.enum(GENDERS).optional(),
  preferred_lang: z.enum(LANGS).optional(),
  is_active:      z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const assignRoleSchema = z.object({
  role:      z.enum(ROLES, { errorMap: () => ({ message: `role must be one of: ${ROLES.join(', ')}` }) }),
  center_id: z.string().uuid('center_id must be a UUID').optional(),
});

const linkGuardianSchema = z.object({
  guardian_user_id: z.string().uuid('guardian_user_id must be a UUID'),
  relation:         z.string().optional(),
  is_primary:       z.boolean().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.get(
  '/users',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  controller.listUsers,
);

router.post(
  '/users',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  validate(createUserSchema),
  controller.createUser,
);

router.get(
  '/users/:user_id',
  requireAuth,
  controller.getUser,
);

router.patch(
  '/users/:user_id',
  requireAuth,
  validate(updateUserSchema),
  controller.updateUser,
);

router.post(
  '/users/:user_id/roles',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  validate(assignRoleSchema),
  controller.assignRole,
);

router.delete(
  '/users/:user_id/roles/:role_id',
  requireAuth,
  requireRoles('super_admin'),
  controller.removeRole,
);

router.delete(
  '/users/:user_id/center/:center_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  controller.removeUserFromCenter,
);

router.post(
  '/users/:user_id/guardians',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  validate(linkGuardianSchema),
  controller.linkGuardian,
);

router.get(
  '/users/:user_id/guardians',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  controller.listGuardians,
);

module.exports = router;
