const { Router } = require('express');
const requireAuth  = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/rbac');
const controller   = require('../controllers/reports.controller');

const router = Router();

// ── Routes ────────────────────────────────────────────────────────────────────

// Org-wide summary — super_admin only (reports.view_org seed)
router.get(
  '/reports/org/overview',
  requireAuth,
  requirePermission('reports.view_org'),
  controller.getOrgOverview,
);

// Center-level summary — managers and super_admin
router.get(
  '/reports/centers/:center_id/overview',
  requireAuth,
  requirePermission('reports.view_center'),
  controller.getCenterOverview,
);

// Full student report card — any authenticated user (own/guardian scoping in controller)
router.get(
  '/reports/students/:user_id/summary',
  requireAuth,
  controller.getStudentSummary,
);

// Per-criterion homework breakdown — teachers use reports.view_student;
// managers use reports.view_center
router.get(
  '/reports/classes/:class_id/homework-performance',
  requireAuth,
  requireAnyPermission('reports.view_center', 'reports.view_student'),
  controller.getHomeworkPerformance,
);

module.exports = router;
