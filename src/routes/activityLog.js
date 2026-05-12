const router = require('express').Router();
const requireAuth    = require('../middleware/auth');
const requireRoles   = require('../middleware/rbac');
const ctrl           = require('../controllers/activityLog.controller');

// Per-center activity feed — visible to super_admin and center_manager
router.get(
  '/centers/:center_id/activity',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  ctrl.listCenterActivity,
);

// Org-wide activity feed — super_admin only
router.get(
  '/activity',
  requireAuth,
  requireRoles('super_admin'),
  ctrl.listOrgActivity,
);

module.exports = router;
