const knex     = require('../db/knex');
const { getRedis } = require('../utils/redis');
const { AppError } = require('../utils/errors');

const PERM_CACHE_PREFIX = 'permissions:';
const PERM_CACHE_TTL    = 300; // 5 minutes

// ── Core resolver ─────────────────────────────────────────────────────────────

// Returns a Set<string> of permission keys for a user.
// Precedence (high → low):
//   1. user_permissions.is_granted = false  → explicit deny  (wins over role grant)
//   2. user_permissions.is_granted = true   → explicit grant (adds to set)
//   3. role_permissions                     → base role grants
async function getUserPermissions(userId) {
  // 1. Load role IDs attached to this user
  const userRoles = await knex('user_roles')
    .where('user_id', userId)
    .select('role_id');

  const roleIds = userRoles.map((r) => r.role_id);

  // 2. Aggregate all permissions granted by those roles
  const rolePermKeys = new Set();
  if (roleIds.length > 0) {
    const rows = await knex('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .whereIn('role_permissions.role_id', roleIds)
      .where('permissions.is_active', true)
      .select('permissions.key');
    rows.forEach((r) => rolePermKeys.add(r.key));
  }

  // 3. Load per-user overrides
  const overrides = await knex('user_permissions')
    .join('permissions', 'user_permissions.permission_id', 'permissions.id')
    .where('user_permissions.user_id', userId)
    .where('permissions.is_active', true)
    .select('permissions.key', 'user_permissions.is_granted');

  // 4. Merge: start from role grants, apply overrides
  const resolved = new Set(rolePermKeys);
  for (const ov of overrides) {
    if (ov.is_granted) resolved.add(ov.key);
    else               resolved.delete(ov.key);
  }

  return resolved;
}

// ── Cache-aware resolver (used by middleware) ─────────────────────────────────

async function getCachedPermissions(userId) {
  const cacheKey = `${PERM_CACHE_PREFIX}${userId}`;
  try {
    const redis  = await getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) return new Set(JSON.parse(cached));

    const perms = await getUserPermissions(userId);
    await redis.setEx(cacheKey, PERM_CACHE_TTL, JSON.stringify([...perms]));
    return perms;
  } catch (_redisErr) {
    // Redis unavailable — degrade to direct DB lookup
    return getUserPermissions(userId);
  }
}

// Deletes Redis cache entries for the given user IDs.
// Call after any role_permissions or user_permissions change.
async function invalidatePermissionCache(userIds) {
  if (!userIds || userIds.length === 0) return;
  try {
    const redis = await getRedis();
    await Promise.all(userIds.map((id) => redis.del(`${PERM_CACHE_PREFIX}${id}`)));
  } catch (err) {
    console.error('Permission cache invalidation failed:', err.message);
  }
}

// Helper: find all user IDs that carry a specific role (for bulk invalidation)
async function getUserIdsByRole(roleId) {
  const rows = await knex('user_roles').where('role_id', roleId).select('user_id');
  return rows.map((r) => r.user_id);
}

// ── Roles ─────────────────────────────────────────────────────────────────────

async function getRoles({ is_active } = {}) {
  const q = knex('roles').orderBy('name');
  if (is_active !== undefined) q.where('is_active', is_active);
  return q;
}

async function createRole(data) {
  const [row] = await knex('roles').insert(data).returning('*');
  return row;
}

async function updateRole(roleId, data) {
  const [row] = await knex('roles').where('id', roleId).update(data).returning('*');
  return row;
}

async function deleteRole(roleId) {
  const role = await knex('roles').where('id', roleId).first();
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);
  if (role.is_system) {
    throw new AppError('SYSTEM_ROLE', 'System roles cannot be deleted.', 'سسٹم کردار حذف نہیں کیا جا سکتا۔', 400);
  }
  await knex('roles').where('id', roleId).delete();
}

// ── Role permissions ──────────────────────────────────────────────────────────

async function getRolePermissions(roleId) {
  return knex('role_permissions')
    .join('permissions', 'role_permissions.permission_id', 'permissions.id')
    .where('role_permissions.role_id', roleId)
    .select('permissions.*', 'role_permissions.granted_at');
}

// Full replace: delete all existing role_permissions, insert new set.
// Invalidates cache for every user carrying this role.
async function setRolePermissions(roleId, permissionIds, grantedBy = null) {
  await knex.transaction(async (trx) => {
    await trx('role_permissions').where('role_id', roleId).delete();
    if (permissionIds.length > 0) {
      await trx('role_permissions').insert(
        permissionIds.map((pid) => ({
          role_id:       roleId,
          permission_id: pid,
          granted_by:    grantedBy,
        })),
      );
    }
  });

  const affected = await getUserIdsByRole(roleId);
  await invalidatePermissionCache(affected);
}

// ── Permissions ───────────────────────────────────────────────────────────────

async function getPermissions({ module: mod, is_active } = {}) {
  const q = knex('permissions').orderBy(['module', 'action']);
  if (mod)        q.where('module', mod);
  if (is_active !== undefined) q.where('is_active', is_active);
  return q;
}

async function createPermission(data) {
  const [row] = await knex('permissions').insert(data).returning('*');
  return row;
}

async function updatePermission(permissionId, data) {
  const [row] = await knex('permissions')
    .where('id', permissionId)
    .update(data)
    .returning('*');
  return row;
}

// ── User permission overrides ──────────────────────────────────────────────────

async function getUserPermissionOverrides(userId) {
  return knex('user_permissions')
    .join('permissions', 'user_permissions.permission_id', 'permissions.id')
    .where('user_permissions.user_id', userId)
    .select('permissions.key', 'permissions.label', 'user_permissions.is_granted', 'user_permissions.granted_at');
}

async function setUserPermissionOverride(userId, permissionId, isGranted, grantedBy = null) {
  await knex('user_permissions')
    .insert({ user_id: userId, permission_id: permissionId, is_granted: isGranted, granted_by: grantedBy })
    .onConflict(['user_id', 'permission_id'])
    .merge({ is_granted: isGranted, granted_by: grantedBy, granted_at: knex.fn.now() });

  await invalidatePermissionCache([userId]);
}

async function removeUserPermissionOverride(userId, permissionId) {
  await knex('user_permissions')
    .where({ user_id: userId, permission_id: permissionId })
    .delete();

  await invalidatePermissionCache([userId]);
}

module.exports = {
  // Core
  getUserPermissions,
  getCachedPermissions,
  invalidatePermissionCache,
  // Roles
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
  // Permissions
  getPermissions,
  createPermission,
  updatePermission,
  // User overrides
  getUserPermissionOverrides,
  setUserPermissionOverride,
  removeUserPermissionOverride,
};
