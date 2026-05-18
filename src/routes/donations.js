const express = require('express');
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const ctrl = require('../controllers/donations.controller');

const router = express.Router();

router.use(requireAuth);

// Donations are organization-level (no center in URL)
router.post('/', requirePermission('donations.create'), ctrl.recordDonation);
router.get('/', requirePermission('donations.view'), ctrl.listDonations);

module.exports = router;
