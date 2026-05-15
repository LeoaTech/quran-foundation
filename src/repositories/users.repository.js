const db = require('../db/knex');

// ── Users ──────────────────────────────────────────────────────────────────────

function listUsers({ centerId, role, search, isActive, page = 1, perPage = 20 } = {}) {
  const query = db('users as u')
    .join('user_roles as ur', 'ur.user_id', 'u.id')
    .join('roles as r', 'r.id', 'ur.role_id')
    .select(
      'u.id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
      'u.email',
      'u.gender',
      'u.date_of_birth',
      'u.preferred_lang',
      'u.is_active',
      'u.created_at',
      'r.name as role',
      'ur.center_id',
    )
    .orderBy('u.full_name', 'asc');

  if (centerId !== undefined) query.where('ur.center_id', centerId);
  if (role !== undefined) query.where('r.name', role);
  if (isActive !== undefined) query.where('u.is_active', isActive);
  if (search) {
    query.where((q) => {
      q.whereILike('u.full_name', `%${search}%`)
       .orWhereILike('u.full_name_ur', `%${search}%`);
    });
  }

  return query.limit(perPage).offset((page - 1) * perPage);
}

function countUsers({ centerId, role, search, isActive } = {}) {
  const query = db('users as u')
    .join('user_roles as ur', 'ur.user_id', 'u.id')
    .join('roles as r', 'r.id', 'ur.role_id')
    .countDistinct('u.id as total');

  if (centerId !== undefined) query.where('ur.center_id', centerId);
  if (role !== undefined) query.where('r.name', role);
  if (isActive !== undefined) query.where('u.is_active', isActive);
  if (search) {
    query.where((q) => {
      q.whereILike('u.full_name', `%${search}%`)
       .orWhereILike('u.full_name_ur', `%${search}%`);
    });
  }

  return query.first();
}

function getUserById(userId) {
  return db('users').where({ id: userId }).first();
}

function getUserWithRoles(userId) {
  return db('users as u')
    .where('u.id', userId)
    .first()
    .then(async (user) => {
      if (!user) return null;
      const roles = await db('user_roles as ur')
        .join('roles as r', 'r.id', 'ur.role_id')
        .where('ur.user_id', userId)
        .select('ur.id as user_role_id', 'r.name as role', 'ur.center_id', 'ur.assigned_at');
      return { ...user, roles };
    });
}

async function createUser({ userData, roleData, staffData }, trx) {
  const t = trx || db;

  const [user] = await t('users')
    .insert({
      full_name:      userData.full_name,
      full_name_ur:   userData.full_name_ur,
      phone:          userData.phone,
      whatsapp:       userData.whatsapp,
      date_of_birth:  userData.date_of_birth,
      gender:         userData.gender,
      email:          userData.email,
      password_hash:  userData.password_hash,
      preferred_lang: userData.preferred_lang || 'ur',
      is_active:      true,
    })
    .returning('*');

  const roleRow = await t('roles').where({ name: roleData.role }).first();
  if (!roleRow) throw new Error(`Role '${roleData.role}' not found`);

  await t('user_roles').insert({
    user_id:   user.id,
    role_id:   roleRow.id,
    center_id: roleData.center_id || null,
  });

  if (staffData && roleData.center_id) {
    const insertData = {
      user_id: user.id,
      center_id: roleData.center_id,
      base_salary: staffData.base_salary || 0,
    };
    if (staffData.joining_date) insertData.joining_date = staffData.joining_date;
    if (staffData.payment_method) insertData.payment_method = staffData.payment_method;
    if (staffData.bank_name) insertData.bank_name = staffData.bank_name;
    if (staffData.account_number) insertData.account_number = staffData.account_number;

    await t('staff_details').insert(insertData);
  }

  return user;
}

async function updateUser(userId, data) {
  const [row] = await db('users')
    .where({ id: userId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Roles ──────────────────────────────────────────────────────────────────────

function getRoleByName(name) {
  return db('roles').where({ name }).first();
}

function getUserRoleEntry(userId, roleId, centerId) {
  const query = db('user_roles').where({ user_id: userId, role_id: roleId });
  if (centerId !== null && centerId !== undefined) {
    query.where({ center_id: centerId });
  } else {
    query.whereNull('center_id');
  }
  return query.first();
}

async function assignRole({ userId, roleId, centerId }) {
  const [row] = await db('user_roles')
    .insert({ user_id: userId, role_id: roleId, center_id: centerId || null })
    .returning('*');
  return row;
}

async function removeRole(userRoleId) {
  await db('user_roles').where({ id: userRoleId }).delete();
}

// ── Guardians ──────────────────────────────────────────────────────────────────

async function linkGuardian({ studentUserId, guardianUserId, relation, isPrimary }) {
  const [row] = await db('guardians')
    .insert({
      student_user_id:  studentUserId,
      guardian_user_id: guardianUserId,
      relation:         relation || null,
      is_primary:       isPrimary || false,
    })
    .returning('*');
  return row;
}

function listGuardians(studentUserId) {
  return db('guardians as g')
    .join('users as u', 'u.id', 'g.guardian_user_id')
    .where('g.student_user_id', studentUserId)
    .select(
      'g.id',
      'g.relation',
      'g.is_primary',
      'u.id as guardian_user_id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
      'u.whatsapp',
    );
}

function getGuardianLink(studentUserId, guardianUserId) {
  return db('guardians')
    .where({ student_user_id: studentUserId, guardian_user_id: guardianUserId })
    .first();
}

module.exports = {
  listUsers,
  countUsers,
  getUserById,
  getUserWithRoles,
  createUser,
  updateUser,
  getRoleByName,
  getUserRoleEntry,
  assignRole,
  removeRole,
  linkGuardian,
  listGuardians,
  getGuardianLink,
};
