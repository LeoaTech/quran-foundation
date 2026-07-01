const { Router } = require('express');
const { z }      = require('zod');
const requireAuth  = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate     = require('../middleware/validate');
const upload       = require('../middleware/upload');
const controller   = require('../controllers/users.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const ROLES   = ['super_admin', 'center_manager', 'finance_manager', 'teacher', 'student', 'guardian'];
const GENDERS = ['male', 'female', 'other'];
const LANGS   = ['en', 'ur', 'ar'];

const createUserSchema = z.object({
  full_name:         z.string().min(1, 'full_name is required'),
  full_name_ur:      z.string().optional(),
  // Phone is optional at schema level; .refine() enforces it for non-minor students.
  phone:             z.string().optional(),
  whatsapp:          z.string().optional(),
  email:             z.string().email().optional(),
  date_of_birth:     z.string().date('date_of_birth must be YYYY-MM-DD').optional(),
  gender:            z.enum(GENDERS).optional(),
  preferred_lang:    z.enum(LANGS).optional(),
  role:              z.enum(ROLES, { errorMap: () => ({ message: `role must be one of: ${ROLES.join(', ')}` }) }),
  center_id:         z.string().uuid('center_id must be a UUID').optional(),
  base_salary:       z.number().min(0).optional(),
  joining_date:      z.string().date().optional(),
  payment_method:    z.string().optional(),
  bank_name:         z.string().optional(),
  account_number:    z.string().optional(),
  // Minor student fields (only used when role = 'student')
  is_minor:          z.boolean().optional().default(false),
  guardian_name:     z.string().max(255).optional(),
  guardian_phone:    z.string().optional(),
  guardian_relation: z.string().max(50).optional(),
}).refine(
  (data) => data.role !== 'student' || data.is_minor || (!!data.phone && data.phone.trim().length > 0),
  { message: 'phone is required for adult students', path: ['phone'] },
).refine(
  (data) => data.role !== 'student' || !data.is_minor || (!!data.guardian_phone && data.guardian_phone.trim().length > 0),
  { message: 'guardian_phone is required for minor students', path: ['guardian_phone'] },
).refine(
  // Non-student roles always need a phone
  (data) => data.role === 'student' || (!!data.phone && data.phone.trim().length > 0),
  { message: 'phone is required', path: ['phone'] },
);

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
  is_active:      z.boolean().optional(),
  qualification:  z.string().max(100).optional(),
  occupation:     z.string().max(100).optional(),
  marital_status: z.string().max(50).optional(),
  is_repeater:    z.string().optional().transform(v => v === 'true' || v === 'yes' || v === 'on'),
  address:        z.string().optional(),
  center_manager_name: z.string().max(255).optional(),
  center_manager_contact: z.string().max(50).optional(),
  father_name:     z.string().max(255).optional(),
  full_name:       z.string().min(1).optional(),
  full_name_ur:    z.string().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: 'Request body must contain at least one field to update.',
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
});

const updateStaffProfileSchema = z.object({
  full_name:      z.string().min(1).optional(),
  phone:          z.string().optional(),
  role:           z.enum(ROLES).optional(),
  center_id:      z.string().uuid().optional(),
  base_salary:    z.number().min(0).optional(),
  joining_date:   z.string().date().optional(),
  payment_method: z.string().optional(),
  bank_name:      z.string().optional(),
  account_number: z.string().optional(),
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
  requirePermission('users.view'),
  controller.listUsers,
);

router.post(
  '/users',
  requireAuth,
  requirePermission('users.create'),
  validate(createUserSchema),
  controller.createUser,
);

// Any authenticated user can view a profile (own + others within center scope)
router.get(
  '/users/:user_id',
  requireAuth,
  controller.getUser,
);

// Any authenticated user can update own profile; controller enforces ownership
router.patch(
  '/users/:user_id',
  requireAuth,
  validate(updateUserSchema),
  controller.updateUser,
);

// Advanced profile update with file upload
router.patch(
  '/users/:user_id/profile',
  requireAuth,
  upload.single('profile_picture'),
  validate(updateUserSchema),
  controller.updateProfile,
);

router.post(
  '/users/:user_id/change-password',
  requireAuth,
  validate(changePasswordSchema),
  controller.changePassword,
);

router.post(
  '/users/:user_id/regenerate-password',
  requireAuth,
  requirePermission('users.edit'),
  controller.regeneratePassword,
);

router.patch(
  '/users/:user_id/center/:center_id/staff_profile',
  requireAuth,
  requirePermission('users.edit'),
  validate(updateStaffProfileSchema),
  controller.updateStaffProfile,
);

router.post(
  '/users/:user_id/roles',
  requireAuth,
  requirePermission('roles.assign'),
  validate(assignRoleSchema),
  controller.assignRole,
);

router.delete(
  '/users/:user_id/roles/:role_id',
  requireAuth,
  requirePermission('roles.assign'),
  controller.removeRole,
);

router.delete(
  '/users/:user_id/center/:center_id',
  requireAuth,
  requirePermission('users.edit'),
  controller.removeUserFromCenter,
);

router.post(
  '/users/:user_id/guardians',
  requireAuth,
  requirePermission('users.edit'),
  validate(linkGuardianSchema),
  controller.linkGuardian,
);

router.get(
  '/users/:user_id/guardians',
  requireAuth,
  requirePermission('users.view'),
  controller.listGuardians,
);

module.exports = router;
