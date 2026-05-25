const repo = require('../repositories/salaries.repository');
const usersRepo = require('../repositories/users.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');

function forbidden() {
  return new AppError('FORBIDDEN', 'Access denied', 'رسائی کی اجازت نہیں', 403);
}

function assertCenterScope(user, centerId) {
  if (user.roles.includes('super_admin') || user.roles.includes('finance_manager')) return;
  if (!centerId || user.center_id !== centerId) {
    throw forbidden();
  }
}

async function listStaffDetails({ user: caller, centerId }) {
  assertCenterScope(caller, centerId);
  const isManager = caller.roles.includes('center_manager') && !caller.roles.includes('super_admin') && !caller.roles.includes('finance_manager');
  const filterRoles = isManager ? ['teacher'] : ['teacher', 'center_manager', 'finance_manager', 'area_manager'];
  return repo.listStaffDetails(centerId, filterRoles);
}

async function updateBaseSalary({ user: caller, centerId, staffUserId, baseSalary }) {
  assertCenterScope(caller, centerId);

  // Validate that staff belongs to center
  const roleEntry = await usersRepo.getUserRoleEntry(staffUserId, null, centerId);
  // Wait, getUserRoleEntry requires roleId. Let's just check if they are in the center.
  const targetUser = await usersRepo.getUserWithRoles(staffUserId);
  if (!targetUser) throw new AppError('NOT_FOUND', 'User not found', 'صارف نہیں ملا', 404);
  
  const inCenter = targetUser.roles.some((r) => r.center_id === centerId);
  if (!inCenter) throw forbidden();

  const updated = await repo.updateBaseSalary(staffUserId, centerId, baseSalary);

  activityLog.log({
    actor: caller,
    action: 'salary.update',
    entity_type: 'staff_details',
    entity_id: staffUserId,
    center_id: centerId,
    summary_en: `Updated base salary for "${targetUser.full_name}"`,
  }).catch(() => {});

  return updated;
}

async function recordPayment({ user: caller, centerId, body }) {
  assertCenterScope(caller, centerId);

  const { staff_user_id, amount_paid, payment_method, payment_date, notes } = body;
  const staffUser = await usersRepo.getUserById(staff_user_id);

  const paymentData = {
    staff_user_id,
    center_id: centerId,
    amount_paid,
    payment_method: payment_method || 'cash',
    payment_date: payment_date || undefined,
    notes,
    paid_by_user_id: caller.id,
  };

  const payment = await repo.recordPayment(paymentData);

  activityLog.log({
    actor: caller,
    action: 'salary.payment',
    entity_type: 'salary_payments',
    entity_id: payment.id,
    center_id: centerId,
    summary_en: `Recorded salary payment of ${amount_paid} for "${staffUser?.full_name || staff_user_id}"`,
    metadata: { amount: amount_paid, method: payment_method },
  }).catch(() => {});

  return payment;
}

async function listPayments({ user: caller, centerId, query = {} }) {
  assertCenterScope(caller, centerId);
  
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(200, parseInt(query.per_page || '200', 10));
  const offset = (page - 1) * limit;
  const { month, year } = query;

  const { data, total } = await repo.listPayments(centerId, { limit, offset, month, year });
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: { page, per_page: limit, total, total_pages: totalPages },
  };
}

module.exports = {
  listStaffDetails,
  updateBaseSalary,
  recordPayment,
  listPayments,
};
