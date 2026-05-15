const db = require('../db/knex');

async function listStaffDetails(centerId, filterRoles = ['teacher', 'center_manager', 'finance_manager']) {
  // Join users, user_roles, roles, and staff_details
  return db('users as u')
    .join('user_roles as ur', 'ur.user_id', 'u.id')
    .join('roles as r', 'r.id', 'ur.role_id')
    .leftJoin('staff_details as sd', function() {
      this.on('sd.user_id', '=', 'u.id').andOn('sd.center_id', '=', 'ur.center_id');
    })
    .where('ur.center_id', centerId)
    .whereIn('r.name', filterRoles)
    .select(
      'u.id as user_id',
      'u.full_name',
      'u.phone',
      'r.name as role',
      'sd.base_salary',
      'sd.joining_date',
      'sd.payment_method',
      'sd.bank_name',
      'sd.account_number'
    )
    .orderBy('u.full_name', 'asc');
}

async function getStaffDetail(userId, centerId) {
  return db('staff_details')
    .where({ user_id: userId, center_id: centerId })
    .first();
}

async function updateBaseSalary(userId, centerId, baseSalary) {
  const existing = await getStaffDetail(userId, centerId);
  if (existing) {
    const [row] = await db('staff_details')
      .where({ user_id: userId, center_id: centerId })
      .update({ base_salary: baseSalary, updated_at: db.fn.now() })
      .returning('*');
    return row;
  } else {
    const [row] = await db('staff_details')
      .insert({ user_id: userId, center_id: centerId, base_salary: baseSalary })
      .returning('*');
    return row;
  }
}

async function recordPayment(paymentData, trx) {
  const t = trx || db;
  const [row] = await t('salary_payments')
    .insert(paymentData)
    .returning('*');
  return row;
}

async function listPayments(centerId, { limit = 50, offset = 0 } = {}) {
  const query = db('salary_payments as sp')
    .join('users as staff', 'staff.id', 'sp.staff_user_id')
    .join('users as admin', 'admin.id', 'sp.paid_by_user_id')
    .where('sp.center_id', centerId)
    .select(
      'sp.id',
      'sp.amount_paid',
      'sp.payment_date',
      'sp.payment_method',
      'sp.notes',
      'staff.full_name as staff_name',
      'admin.full_name as paid_by_name'
    )
    .orderBy('sp.payment_date', 'desc')
    .limit(limit)
    .offset(offset);
  
  const countQuery = db('salary_payments').where('center_id', centerId).count('id as total').first();

  const [data, { total }] = await Promise.all([query, countQuery]);
  return { data, total: parseInt(total, 10) };
}

module.exports = {
  listStaffDetails,
  getStaffDetail,
  updateBaseSalary,
  recordPayment,
  listPayments,
};
