const { Router } = require('express');
const { z } = require('zod');
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const controller = require('../controllers/salaries.controller');

const router = Router({ mergeParams: true });

const updateSalarySchema = z.object({
  base_salary: z.number().min(0, 'base_salary must be a positive number'),
});

const recordPaymentSchema = z.object({
  staff_user_id:  z.string().uuid('staff_user_id must be a UUID'),
  amount_paid:    z.number().min(1, 'amount_paid must be greater than 0'),
  payment_method: z.string().optional(),
  payment_date:   z.string().date('payment_date must be YYYY-MM-DD').optional(),
  notes:          z.string().optional(),
});

router.get(
  '/centers/:center_id/salaries/staff',
  requireAuth,
  requirePermission('salaries.view'),
  controller.listStaffDetails,
);

router.put(
  '/centers/:center_id/salaries/staff/:staff_user_id',
  requireAuth,
  requirePermission('salaries.edit'),
  validate(updateSalarySchema),
  controller.updateBaseSalary,
);

router.post(
  '/centers/:center_id/salaries/pay',
  requireAuth,
  requirePermission('salaries.pay'),
  validate(recordPaymentSchema),
  controller.recordPayment,
);

router.get(
  '/centers/:center_id/salaries/payments',
  requireAuth,
  requirePermission('salaries.view'),
  controller.listPayments,
);

module.exports = router;
