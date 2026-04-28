const { Router } = require('express');
const requireAuth  = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const controller   = require('../controllers/reports.controller');

const router = Router();

// ── Routes ────────────────────────────────────────────────────────────────────

// Org-wide summary dashboard — super_admin only.
// Cache: 5 min, key = 'report:org:overview'
router.get(
  '/reports/org/overview',
  requireAuth,
  requireRoles('super_admin'),
  controller.getOrgOverview,
);

// Center-level summary.
// ?month=YYYY-MM  — scopes attendance + progress counts to that month
// Cache: 3 min, key = 'report:center:{id}:{month}'
router.get(
  '/reports/centers/:center_id/overview',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  controller.getCenterOverview,
);

// Full student report card — any authenticated user (own/guardian scoping
// is a product decision deferred to the frontend; the endpoint is open).
// Cache: 2 min, key = 'report:student:{user_id}'
router.get(
  '/reports/students/:user_id/summary',
  requireAuth,
  controller.getStudentSummary,
);

// Per-criterion homework performance breakdown for a class.
// ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
// Not cached (analytical, low traffic, short aggregation window).
router.get(
  '/reports/classes/:class_id/homework-performance',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'teacher'),
  controller.getHomeworkPerformance,
);

module.exports = router;
