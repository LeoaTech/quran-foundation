const router = require('express').Router();
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const ctrl = require('../controllers/activityLog.controller');

// Per-center activity feed — visible to roles with activity.view permission
router.get(
  '/centers/:center_id/activity',
  requireAuth,
  requirePermission('activity.view'),
  ctrl.listCenterActivity,
);

// Org-wide activity feed — requires activity.view permission
router.get(
  '/activity',
  requireAuth,
  requirePermission('activity.view'),
  ctrl.listOrgActivity,
);

module.exports = router;
