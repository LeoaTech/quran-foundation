const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const repo = require('../repositories/users.repository');
const activityLog = require('./activityLog.service');
const db = require('../db/knex');
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
  if (!targetCenterId || String(user.center_id) !== String(targetCenterId)) {
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
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const perPage = Math.min(100, parseInt(query.per_page || '20', 10));

  // center_managers may only see users in their own center
  let centerId = query.center_id;
  if (!user.roles.includes('super_admin') && !user.roles.includes('finance_manager')) {
    centerId = user.center_id;
  }

  const filters = {
    centerId,
    role: query.role,
    search: query.search,
    isActive: query.is_active !== undefined ? query.is_active === 'true' : undefined,
    page,
    perPage,
  };

  const [rows, meta] = await Promise.all([
    repo.listUsers(filters),
    repo.countUsers(filters),
  ]);

  const total = parseInt(meta.total, 10);
  const totalPages = Math.ceil(total / perPage);

  const parsedRows = rows.map(row => {
    let metadata = row.metadata;
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    }
    return { ...row, metadata: metadata || {} };
  });

  return {
    data: parsedRows,
    meta: { page, per_page: perPage, total, total_pages: totalPages },
  };
}

async function getUser({ user: caller, userId }) {
  const user = await repo.getUserWithRoles(userId);
  if (!user) throw notFound();
  return user;
}

async function createUser({ user: caller, body }) {
  const {
    role, center_id: centerId, base_salary, joining_date, payment_method, bank_name, account_number,
    // Minor-specific fields — extracted so they don't land on the users row directly
    is_minor, guardian_name, guardian_phone, guardian_relation,
    ...userData
  } = body;

  // center_manager may only create users in their own center
  assertCenterScope(caller, centerId);

  // For minor students: phone is null (guardian holds the contact phone).
  // For all other users: phone must be unique.
  if (is_minor && role === 'student') {
    // Minor — no phone stored on their user record
    userData.phone    = null;
    userData.whatsapp = null;
  } else if (userData.phone) {
    const existing = await repo.checkPhoneUnique(userData.phone);
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this phone number already exists.', 'اس فون نمبر کا اکاؤنٹ پہلے سے موجود ہے۔', 409);
    }
  }

  if (!VALID_ROLES.includes(role)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.`,
      'غیر درست کردار۔',
      400,
      'role',
    );
  }

  const tempPassword = generateTempPassword();
  const password_hash = await bcrypt.hash(tempPassword, 10);

  const newUser = await db.transaction(async (trx) => {
    const created = await repo.createUser(
      {
        userData: { ...userData, password_hash, is_minor: is_minor || false },
        roleData: { role, center_id: centerId },
        staffData: { base_salary, joining_date, payment_method, bank_name, account_number },
      },
      trx,
    );

    // If this is a minor student and a guardian phone was provided, create/find the
    // guardian user and link them via the guardians table.
    if (is_minor && role === 'student' && guardian_phone) {
      let guardianUser = await trx('users').where({ phone: guardian_phone }).first();

      if (!guardianUser) {
        // Guardian is not yet in the system — create a basic guardian account.
        const guardianName = guardian_name || 'Guardian';
        const guardianPassword = generateTempPassword();
        const guardianHash = await bcrypt.hash(guardianPassword, 10);

        const [newGuardian] = await trx('users').insert({
          full_name: guardianName,
          phone: guardian_phone,
          whatsapp: guardian_phone,
          password_hash: guardianHash,
          preferred_lang: 'ur',
          is_active: true,
          is_minor: false,
        }).returning('*');

        // Assign the 'guardian' role scoped to this center
        const guardianRoleRow = await trx('roles').where({ name: 'guardian' }).first();
        if (guardianRoleRow) {
          await trx('user_roles').insert({
            user_id: newGuardian.id,
            role_id: guardianRoleRow.id,
            center_id: centerId || null,
          }).onConflict(['user_id', 'role_id', 'center_id']).ignore();
        }

        guardianUser = newGuardian;
      }

      // Link student → guardian in the guardians table
      await trx('guardians').insert({
        student_user_id: created.id,
        guardian_user_id: guardianUser.id,
        relation: guardian_relation || null,
        is_primary: true,
      }).onConflict(['student_user_id', 'guardian_user_id']).ignore();
    }

    return created;
  });

  activityLog.log({
    actor: caller,
    action: 'user.create',
    entity_type: 'user',
    entity_id: newUser.id,
    center_id: centerId || null,
    summary_en: `Created user "${newUser.full_name}" with role "${role}"${is_minor ? ' (minor, linked to guardian)' : ''}`,
    metadata: { full_name: newUser.full_name, role, center_id: centerId, is_minor: is_minor || false },
  }).catch(() => { });

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

  if (body.phone) {
    const existing = await repo.checkPhoneUnique(body.phone, userId);
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this phone number already exists.', 'اس فون نمبر کا اکاؤنٹ پہلے سے موجود ہے۔', 409);
    }
  }

  // Disallow changing password through this endpoint
  delete body.password_hash;
  delete body.password;

  const updated = await repo.updateUser(userId, body);
  return updated;
}

async function updateProfile({ user: caller, userId, body }) {
  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  // Allow self-update or super_admin/center_manager
  if (caller.id !== userId && !caller.roles.includes('super_admin') && !caller.roles.includes('center_manager')) {
    throw forbidden();
  }

  if (body.phone) {
    const existing = await repo.checkPhoneUnique(body.phone, userId);
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this phone number already exists.', 'اس فون نمبر کا اکاؤنٹ پہلے سے موجود ہے۔', 409);
    }
  }

  const { full_name, full_name_ur, profile_picture, father_name, qualification, occupation, marital_status, is_repeater, address, center_manager_name, center_manager_contact, ...rest } = body;

  if (full_name !== undefined) rest.full_name = full_name;
  if (full_name_ur !== undefined) rest.full_name_ur = full_name_ur;

  delete rest.password_hash;
  delete rest.password;
  delete rest.role;
  delete rest.center_id;

  let metadata = target.metadata || {};
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
  }

  console.log(metadata, "metadata", body, "Body");

  if (profile_picture !== undefined) metadata.profile_picture = profile_picture;
  if (qualification !== undefined) metadata.qualification = qualification;
  if (occupation !== undefined) metadata.occupation = occupation;
  if (marital_status !== undefined) metadata.marital_status = marital_status;
  if (is_repeater !== undefined) metadata.is_repeater = is_repeater;
  if (address !== undefined) metadata.address = address;
  if (center_manager_name !== undefined) metadata.center_manager_name = center_manager_name;
  if (center_manager_contact !== undefined) metadata.center_manager_contact = center_manager_contact;
  if (father_name !== undefined) metadata.father_name = father_name;

  rest.metadata = JSON.stringify(metadata);

  const updated = await repo.updateUser(userId, rest);
  return updated;
}

async function changePassword({ user: caller, userId, body }) {
  if (caller.id !== userId) {
    throw forbidden();
  }

  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  const { current_password, new_password } = body;
  const isMatch = await bcrypt.compare(current_password, target.password_hash);

  if (!isMatch) {
    throw new AppError('UNAUTHORIZED', 'Incorrect current password', 'موجودہ پاس ورڈ غلط ہے', 401);
  }

  const password_hash = await bcrypt.hash(new_password, 10);
  await db('users').where({ id: userId }).update({ password_hash });
}

async function regeneratePassword({ user: caller, userId }) {
  // Only center_managers and super_admins can regenerate passwords for users
  if (!caller.roles.includes('super_admin') && !caller.roles.includes('center_manager')) {
    throw forbidden();
  }

  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  // If center_manager, verify center scope
  if (!caller.roles.includes('super_admin')) {
    const targetRoles = await db('user_roles').where({ user_id: userId, center_id: caller.center_id }).first();
    if (!targetRoles && caller.id !== userId) {
      throw forbidden();
    }
  }

  const newPassword = generateTempPassword();
  const password_hash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: userId }).update({ password_hash });

  activityLog.log({
    actor: caller,
    action: 'user.password_regenerate',
    entity_type: 'user',
    entity_id: userId,
    center_id: caller.center_id,
    summary_en: `Regenerated password for "${target.full_name}"`,
  }).catch(() => { });

  return { new_password: newPassword };
}

async function updateStaffProfile({ user: caller, userId, oldCenterId, body }) {
  const { role, center_id: newCenterId, base_salary, joining_date, payment_method, bank_name, account_number, ...userData } = body;

  const target = await repo.getUserById(userId);
  if (!target) throw notFound();

  if (userData.phone) {
    const existing = await repo.checkPhoneUnique(userData.phone, userId);
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this phone number already exists.', 'اس فون نمبر کا اکاؤنٹ پہلے سے موجود ہے۔', 409);
    }
  }

  // Validate permission on the *old* center
  assertCenterScope(caller, oldCenterId);

  // If they are changing the center, validate permission on the *new* center
  if (newCenterId && newCenterId !== oldCenterId) {
    assertCenterScope(caller, newCenterId);
  }

  // Determine what role we are dealing with if no new role was provided
  let roleData = {};
  if (role || newCenterId !== undefined) {
    // We need to fetch the existing role if they are only changing center
    if (!role && newCenterId) {
      const existingRoles = await db('user_roles as ur').join('roles as r', 'r.id', 'ur.role_id').where('ur.user_id', userId).where('ur.center_id', oldCenterId).select('r.name as role');
      if (existingRoles.length > 0) roleData.role = existingRoles[0].role;
    } else {
      roleData.role = role;
    }

    if (roleData.role) {
      if (!VALID_ROLES.includes(roleData.role)) {
        throw new AppError('VALIDATION_ERROR', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.`, 'غیر درست کردار۔', 400, 'role');
      }
      // center_manager cannot assign or manage super_admin
      if (roleData.role === 'super_admin' && !caller.roles.includes('super_admin')) {
        throw forbidden();
      }
    }
    if (newCenterId !== undefined) roleData.center_id = newCenterId;
  }

  const staffData = {};
  if (base_salary !== undefined) staffData.base_salary = base_salary;
  if (joining_date !== undefined) staffData.joining_date = joining_date;
  if (payment_method !== undefined) staffData.payment_method = payment_method;
  if (bank_name !== undefined) staffData.bank_name = bank_name;
  if (account_number !== undefined) staffData.account_number = account_number;

  delete userData.password_hash;
  delete userData.password;

  const updated = await repo.updateStaffProfile(userId, oldCenterId, { userData, roleData, staffData });

  activityLog.log({
    actor: caller,
    action: 'staff.update',
    entity_type: 'user',
    entity_id: userId,
    center_id: newCenterId || oldCenterId,
    summary_en: `Updated staff profile for "${target.full_name}"`,
  }).catch(() => { });

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
    actor: caller,
    action: 'user.role_assign',
    entity_type: 'user_role',
    entity_id: userId,
    center_id: centerId || null,
    summary_en: `Assigned role "${role}" to "${target.full_name}"`,
    metadata: { target_user_id: userId, role, center_id: centerId },
  }).catch(() => { });
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
    actor: caller,
    action: 'user.remove_center',
    entity_type: 'user',
    entity_id: userId,
    center_id: centerId,
    summary_en: `Removed user "${target.full_name}" from center`,
  }).catch(() => { });
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
    studentUserId: userId,
    guardianUserId: body.guardian_user_id,
    relation: body.relation,
    isPrimary: body.is_primary,
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
  updateStaffProfile,
  assignRole,
  linkGuardian,
  listGuardians,
  removeUserFromCenter,
  updateProfile,
  changePassword,
  regeneratePassword,
};
