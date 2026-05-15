const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const repo      = require('../repositories/users.repository');
const activityLog = require('./activityLog.service');
const db        = require('../db/knex');
const { AppError } = require('../utils/errors');

// ── Helpers ────────────────────────────────────────────────────────────────────

function notFound(entity = 'User') {
  return new AppError(
    'NOT_FOUND',
    `${entity} not found.`,
    'مطلوبہ صارف نہیں ملا۔',
    404,
  );
}

function forbidden() {
  return new AppError(
    'FORBIDDEN',
    'You do not have access to perform this action.',
    'آپ کو یہ عمل کرنے کی اجازت نہیں ہے۔',
    403,
  );
}

// Throws 403 if a center_manager tries to act on a user outside their center.
function assertCenterScope(user, targetCenterId) {
  if (user.roles.includes('super_admin')) return;
  if (!targetCenterId || user.center_id !== targetCenterId) {
    throw forbidden();
  }
}

function generateTempPassword() {
  // 10 hex chars — easy to copy, hard to guess
  return `Qf${crypto.randomBytes(4).toString('hex')}`;
}

const VALID_ROLES = ['super_admin', 'center_manager', 'finance_manager', 'teacher', 'student', 'guardian'];

// ── Users ──────────────────────────────────────────────────────────────────────

async function listUsers({ user, query = {} } = {}) {
  const page    = Math.max(1, parseInt(query.page    || '1',  10));
  const perPage = Math.min(100, parseInt(query.per_page || '20', 10));

  // center_managers may only see users in their own center
  let centerId = query.center_id;
  if (!user.roles.includes('super_admin')) {
    centerId = user.center_id;
  }

  const filters = {
    centerId,
    role:     query.role,
    search:   query.search,
    isActive: query.is_active !== undefined ? query.is_active === 'true' : undefined,
    page,
    perPage,
  };

  const [rows, meta] = await Promise.all([
    repo.listUsers(filters),
    repo.countUsers(filters),
  ]);

  const total      = parseInt(meta.total, 10);
  const totalPages = Math.ceil(total / perPage);

  return {
    data: rows,
    meta: { page, per_page: perPage, total, total_pages: totalPages },
  };
}

async function getUser({ user: caller, userId }) {
  const user = await repo.getUserWithRoles(userId);
  if (!user) throw notFound();
  return user;
}

async function createUser({ user: caller, body }) {
  const { role, center_id: centerId, base_salary, joining_date, payment_method, bank_name, account_number, ...userData } = body;

  // center_manager may only create users in their own center
  assertCenterScope(caller, centerId);

  if (!VALID_ROLES.includes(role)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.`,
      'غیر درست کردار۔',
      400,
      'role',
    );
  }

  const tempPassword   = generateTempPassword();
  const password_hash  = await bcrypt.hash(tempPassword, 10);

  const newUser = await db.transaction((trx) =>
    repo.createUser(
      { userData: { ...userData, password_hash }, roleData: { role, center_id: centerId }, staffData: { base_salary, joining_date, payment_method, bank_name, account_number } },
      trx,
    ),
  );

  activityLog.log({
    actor:       caller,
    action:      'user.create',
    entity_type: 'user',
    entity_id:   newUser.id,
    center_id:   centerId || null,
    summary_en:  `Created user "${newUser.full_name}" with role "${role}"`,
    metadata:    { full_name: newUser.full_name, role, center_id: centerId },
  }).catch(() => {});

  return { id: newUser.id, full_name: newUser.full_name, temp_password: tempPassword };
}

async function updateUser({ user: caller, userId, body }) {
  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  // Own profile is always allowed; otherwise check center scope
  if (caller.id !== userId) {
    // Determine which center the target belongs to (use caller's center for scope check)
    if (!caller.roles.includes('super_admin')) {
      const targetRoles = await db('user_roles as ur')
        .join('roles as r', 'r.id', 'ur.role_id')
        .where('ur.user_id', userId)
        .select('ur.center_id');
      const inSameCenter = targetRoles.some((r) => r.center_id === caller.center_id);
      if (!inSameCenter) throw forbidden();
    }
  }

  // Disallow changing password through this endpoint
  delete body.password_hash;
  delete body.password;

  const updated = await repo.updateUser(userId, body);
  return updated;
}

// ── Role assignments ────────────────────────────────────────────────────────────

async function assignRole({ user: caller, userId, body }) {
  const { role, center_id: centerId } = body;

  // center_managers may only assign roles within their own center
  assertCenterScope(caller, centerId);

  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  const roleRow = await repo.getRoleByName(role);
  if (!roleRow) {
    throw new AppError(
      'NOT_FOUND',
      `Role '${role}' not found.`,
      'یہ کردار موجود نہیں ہے۔',
      404,
    );
  }

  const existing = await repo.getUserRoleEntry(userId, roleRow.id, centerId);
  if (existing) {
    throw new AppError(
      'CONFLICT',
      'User already has this role at the specified center.',
      'صارف کے پاس اس مرکز میں یہ کردار پہلے سے موجود ہے۔',
      409,
    );
  }

  const assignment = await repo.assignRole({ userId, roleId: roleRow.id, centerId: centerId || null });
  activityLog.log({
    actor:       caller,
    action:      'user.role_assign',
    entity_type: 'user_role',
    entity_id:   userId,
    center_id:   centerId || null,
    summary_en:  `Assigned role "${role}" to user (id: ${userId})`,
    metadata:    { target_user_id: userId, role, center_id: centerId },
  }).catch(() => {});
  return assignment;
}

async function removeRole({ user: caller, userId, userRoleId }) {
  if (!caller.roles.includes('super_admin')) {
    throw forbidden();
  }

  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  await repo.removeRole(userRoleId);
}

async function removeUserFromCenter({ user: caller, userId, centerId }) {
  assertCenterScope(caller, centerId);

  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  await db.transaction(async (trx) => {
    await trx('staff_details').where({ user_id: userId, center_id: centerId }).delete();
    await trx('user_roles').where({ user_id: userId, center_id: centerId }).delete();
  });

  activityLog.log({
    actor:       caller,
    action:      'user.remove_center',
    entity_type: 'user',
    entity_id:   userId,
    center_id:   centerId,
    summary_en:  `Removed user "${target.full_name}" from center`,
  }).catch(() => {});
}

// ── Guardians ──────────────────────────────────────────────────────────────────

async function linkGuardian({ user: caller, userId, body }) {
  // Only center_manager (or super_admin) may link guardians
  if (!caller.roles.includes('super_admin') && !caller.roles.includes('center_manager')) {
    throw forbidden();
  }

  const student = await repo.getUserById(userId);
  if (!student) throw notFound('Student');

  const guardian = await repo.getUserById(body.guardian_user_id);
  if (!guardian) throw notFound('Guardian user');

  const existing = await repo.getGuardianLink(userId, body.guardian_user_id);
  if (existing) {
    throw new AppError(
      'CONFLICT',
      'Guardian is already linked to this student.',
      'یہ سرپرست پہلے سے اس طالب علم کے ساتھ منسلک ہے۔',
      409,
    );
  }

  return repo.linkGuardian({
    studentUserId:  userId,
    guardianUserId: body.guardian_user_id,
    relation:       body.relation,
    isPrimary:      body.is_primary,
  });
}

async function listGuardians({ user: caller, userId }) {
  const student = await repo.getUserById(userId);
  if (!student) throw notFound('Student');

  return repo.listGuardians(userId);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  assignRole,
  linkGuardian,
  listGuardians,
  removeUserFromCenter,
};
