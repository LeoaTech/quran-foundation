const { Router } = require('express');
const { z } = require('zod');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const controller = require('../controllers/auth.controller');

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
  center_id: z.string().uuid('center_id must be a valid UUID').optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Public
router.post('/login',   validate(loginSchema),   controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);

// Authenticated
router.post('/logout',          requireAuth, validate(logoutSchema),         controller.logout);
router.post('/change-password', requireAuth, validate(changePasswordSchema), controller.changePassword);

module.exports = router;
