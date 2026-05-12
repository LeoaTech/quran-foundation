const express = require('express');
const requireAuth = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const ctrl = require('../controllers/donations.controller');

const router = express.Router();

router.use(requireAuth);
// Only super_admin and center_manager should manage donations
router.use(requireRoles('super_admin', 'center_manager'));

// Donations are tied to a specific center
router.post('/centers/:centerId', ctrl.recordDonation);
router.get('/centers/:centerId', ctrl.listDonations);

module.exports = router;
