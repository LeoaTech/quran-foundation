const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authRepo = require('../repositories/auth.repository');
const { getRedis } = require('../utils/redis');
const { AppError } = require('../utils/errors');

const revokedKey = (jti) => `revoked:jti:${jti}`;

// Identical error for "user not found" and "wrong password" — prevents user enumeration.
const invalidCredentials = () => new AppError(
  'INVALID_CREDENTIALS',
  'Phone number or password is incorrect.',
  'فون نمبر یا پاس ورڈ غلط ہے۔',
  401,
);

function signAccess(sub, roles, center_id) {
  return jwt.sign(
    { sub, type: 'access', roles, center_id },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' },
  );
}

function signRefresh(sub, jti, center_id) {
  return jwt.sign(
    { sub, type: 'refresh', jti, center_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d' },
  );
}

// Derive { roles, scopedCenterId } from the user's role rows.
// center_id from request body scopes the session; if omitted, first available center is used.
function resolveScope(allRoles, requestedCenterId) {
  // super_admin has a role entry with center_id = null
  const isSuperAdmin = allRoles.some((r) => r.role === 'super_admin' && r.center_id === null);
  if (isSuperAdmin) {
    return { roles: ['super_admin'], scopedCenterId: requestedCenterId || null };
  }

  const target = requestedCenterId || allRoles[0]?.center_id;
  if (!target) {
    throw new AppError('FORBIDDEN', 'No active role found for this user.', 'اس صارف کا کوئی فعال کردار نہیں ملا۔', 403);
  }

  const centerRoles = allRoles.filter((r) => r.center_id === target);
  if (!centerRoles.length) {
    throw new AppError('FORBIDDEN', 'User has no role at the specified center.', 'صارف کا مخصوص مرکز میں کوئی کردار نہیں ہے۔', 403);
  }

  return {
    roles: [...new Set(centerRoles.map((r) => r.role))],
    scopedCenterId: target,
  };
}

async function login({ phone, password, center_id }) {
  const user = await authRepo.findByPhone(phone);
  if (!user) throw invalidCredentials();

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw invalidCredentials();

  const allRoles = await authRepo.getUserRoles(user.id);
  const { roles, scopedCenterId } = resolveScope(allRoles, center_id);

  const jti = uuidv4();
  const access_token = signAccess(user.id, roles, scopedCenterId);
  const refresh_token = signRefresh(user.id, jti, scopedCenterId);

  await authRepo.updateLastLogin(user.id);

  return {
    access_token,
    refresh_token,
    user: {
      id: user.id,
      full_name: user.full_name,
      full_name_ur: user.full_name_ur,
      preferred_lang: user.preferred_lang,
      roles,
      center_id: scopedCenterId,
    },
  };
}

async function refresh({ refresh_token }) {
  let payload;
  try {
    payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('INVALID_TOKEN', 'Invalid or expired refresh token.', 'ریفریش ٹوکن غلط یا میعاد ختم ہے۔', 401);
  }

  if (payload.type !== 'refresh') {
    throw new AppError('INVALID_TOKEN', 'Invalid token type.', 'ٹوکن کی قسم غلط ہے۔', 401);
  }

  const redis = await getRedis();
  if (await redis.get(revokedKey(payload.jti))) {
    throw new AppError('TOKEN_REVOKED', 'Refresh token has been revoked.', 'ریفریش ٹوکن منسوخ کر دیا گیا ہے۔', 401);
  }

  const user = await authRepo.findById(payload.sub);
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'User account not found or inactive.', 'صارف کا اکاؤنٹ نہیں ملا یا غیر فعال ہے۔', 401);
  }

  // Reload roles so any permission changes take effect on the new access token
  const allRoles = await authRepo.getUserRoles(user.id);
  const isSuperAdmin = allRoles.some((r) => r.role === 'super_admin' && r.center_id === null);
  let roles;
  if (isSuperAdmin) {
    roles = ['super_admin'];
  } else {
    const scoped = payload.center_id
      ? allRoles.filter((r) => r.center_id === payload.center_id)
      : allRoles;
    roles = [...new Set(scoped.map((r) => r.role))];
  }

  return { access_token: signAccess(user.id, roles, payload.center_id) };
}

async function logout({ refresh_token }) {
  let payload;
  try {
    payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return; // Already expired — nothing to revoke
  }

  if (payload.type !== 'refresh' || !payload.jti) return;

  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    const redis = await getRedis();
    await redis.set(revokedKey(payload.jti), '1', { EX: ttl });
  }
}

async function changePassword({ userId, current_password, new_password }) {
  const user = await authRepo.findById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found.', 'صارف نہیں ملا۔', 404);
  }

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect.', 'موجودہ پاس ورڈ غلط ہے۔', 400);
  }

  const hash = await bcrypt.hash(new_password, 12);
  await authRepo.updatePassword(userId, hash);
}

// ── Student Signup ────────────────────────────────────────────────────────────
// Creates a new user with the 'student' role at the selected center.
// Everything runs in a DB transaction so any failure rolls back completely.

async function signup({ full_name, full_name_ur, phone, password, center_id }) {
  const db = require('../db/knex');

  // 1. Check that center exists and is active
  const center = await db('centers').where({ id: center_id, is_active: true }).first();
  if (!center) {
    throw new AppError('NOT_FOUND', 'Center not found or inactive.', 'مرکز نہیں ملا یا غیر فعال ہے۔', 404);
  }

  // 2. Check for duplicate phone
  const existing = await authRepo.findByPhone(phone);
  if (existing) {
    throw new AppError('CONFLICT', 'An account with this phone number already exists.', 'اس فون نمبر کا اکاؤنٹ پہلے سے موجود ہے۔', 409);
  }

  // 3. Hash the password
  const password_hash = await bcrypt.hash(password, 12);

  // 4. Transactional: create user + assign student role
  const newUser = await db.transaction(async (trx) => {
    // Generate a placeholder email from phone (email column is NOT NULL in the DB)
    const emailPlaceholder = `${phone.replace(/[^0-9]/g, '')}@student.qf.local`;

    const [user] = await trx('users').insert({
      full_name,
      full_name_ur: full_name_ur || null,
      phone,
      email: emailPlaceholder,
      password_hash,
      preferred_lang: 'ur',
      is_active: true,
    }).returning('*');

    const roleRow = await trx('roles').where({ name: 'student' }).first();
    if (!roleRow) throw new Error("Role 'student' not found in roles table.");

    await trx('user_roles').insert({
      user_id: user.id,
      role_id: roleRow.id,
      center_id: center_id,
    });

    return user;
  });

  // 5. Auto-login: issue tokens so the student can start using the app immediately
  const roles = ['student'];
  const jti = uuidv4();
  const access_token = signAccess(newUser.id, roles, center_id);
  const refresh_token = signRefresh(newUser.id, jti, center_id);

  return {
    access_token,
    refresh_token,
    user: {
      id: newUser.id,
      full_name: newUser.full_name,
      full_name_ur: newUser.full_name_ur,
      preferred_lang: newUser.preferred_lang,
      roles,
      center_id,
    },
  };
}

// ── Public Centers List (for Signup form) ────────────────────────────────────

async function listPublicCenters() {
  const db = require('../db/knex');
  return db('centers')
    .where({ is_active: true })
    .select('id', 'name', 'name_ur', 'city')
    .orderBy('name', 'asc');
}

module.exports = { login, refresh, logout, changePassword, signup, listPublicCenters };
