const { Router } = require('express');
const { z } = require('zod');
const requireAuth = require('../middleware/auth');
const requireRoles = require('../middleware/rbac');
const validate = require('../middleware/validate');
const controller = require('../controllers/salaries.controller');

const router = Router({ mergeParams: true }); // to access :center_id from parent if needed
// Actually, let's just use absolute routes

const updateSalarySchema = z.object({
  base_salary: z.number().min(0, 'base_salary must be a positive number'),
});

const recordPaymentSchema = z.object({
  staff_user_id: z.string().uuid('staff_user_id must be a UUID'),
  amount_paid: z.number().min(1, 'amount_paid must be greater than 0'),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

router.get(
  '/centers/:center_id/salaries/staff',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'finance_manager'),
  controller.listStaffDetails
);

router.put(
  '/centers/:center_id/salaries/staff/:staff_user_id',
  requireAuth,
  requireRoles('super_admin', 'center_manager'),
  validate(updateSalarySchema),
  controller.updateBaseSalary
);

router.post(
  '/centers/:center_id/salaries/pay',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'finance_manager'),
  validate(recordPaymentSchema),
  controller.recordPayment
);

router.get(
  '/centers/:center_id/salaries/payments',
  requireAuth,
  requireRoles('super_admin', 'center_manager', 'finance_manager'),
  controller.listPayments
);

module.exports = router;
