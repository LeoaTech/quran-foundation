const knex = require('../db/knex');
const repo = require('../repositories/permissions');
const { AppError } = require('../utils/errors');

// ── Roles ─────────────────────────────────────────────────────────────────────

async function listRoles({ include } = {}) {
  const roles = await repo.getRolesWithStats();

  if (include !== 'permissions') return roles;

  // Embed full permissions arrays — one query, then distribute
  const allRolePerms = await knex('role_permissions')
    .join('permissions', 'role_permissions.permission_id', 'permissions.id')
    .select('role_permissions.role_id', 'permissions.id', 'permissions.key', 'permissions.label', 'permissions.label_ur', 'permissions.module', 'permissions.action');

  const permMap = {};
  for (const rp of allRolePerms) {
    if (!permMap[rp.role_id]) permMap[rp.role_id] = [];
    permMap[rp.role_id].push({ id: rp.id, key: rp.key, label: rp.label, label_ur: rp.label_ur, module: rp.module, action: rp.action });
  }

  return roles.map((r) => ({ ...r, permissions: permMap[r.id] ?? [] }));
}

async function getRole(roleId) {
  const role = await repo.getRoleById(roleId);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);

  const permissions = await repo.getRolePermissions(roleId);
  return { ...role, permissions };
}

async function createRole({ body, userId }) {
  const { name, description, label_ur, color } = body;

  const existing = await knex('roles').where('name', name).first();
  if (existing) throw new AppError('CONFLICT', `Role '${name}' already exists.`, `کردار '${name}' پہلے سے موجود ہے۔`, 409);

  return repo.createRole({ name, description, label_ur, color, is_system: false, created_by: userId });
}

async function updateRole({ roleId, body }) {
  const role = await repo.getRoleById(roleId);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);

  // System roles: only description, label_ur, color may be changed
  const allowed = role.is_system
    ? ['description', 'label_ur', 'color']
    : ['name', 'description', 'label_ur', 'color', 'is_active'];

  const patch = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No editable fields provided.', 'کوئی قابل ترمیم فیلڈ نہیں دی گئی۔', 400);
  }

  return repo.updateRole(roleId, patch);
}

async function deleteRole({ roleId }) {
  const role = await repo.getRoleById(roleId);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);
  if (role.is_system) {
    throw new AppError('SYSTEM_ROLE', 'System roles cannot be deleted.', 'سسٹم کردار حذف نہیں کیا جا سکتا۔', 400);
  }

  const [{ count }] = await knex('user_roles').where('role_id', roleId).count('user_id as count');
  const userCount = parseInt(count, 10);
  if (userCount > 0) {
    const err = new AppError('ROLE_IN_USE', `Cannot delete — ${userCount} user(s) currently hold this role.`, `${userCount} صارف اس کردار کے ساتھ ہیں — حذف نہیں کیا جا سکتا۔`, 409);
    err.user_count = userCount;
    throw err;
  }

  await repo.deleteRole(roleId);
}

// ── Role permissions ──────────────────────────────────────────────────────────

async function getRolePermissions(roleId) {
  const role = await repo.getRoleById(roleId);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);
  return repo.getAllPermissionsWithRoleFlag(roleId);
}

async function setRolePermissions({ roleId, body, userId }) {
  const role = await repo.getRoleById(roleId);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);

  const { permission_ids } = body;

  // Verify all supplied IDs exist
  if (permission_ids.length > 0) {
    const found = await knex('permissions').whereIn('id', permission_ids).select('id');
    if (found.length !== permission_ids.length) {
      throw new AppError('VALIDATION_ERROR', 'One or more permission_ids are invalid.', 'ایک یا زیادہ permission_ids غلط ہیں۔', 400);
    }
  }

  await repo.setRolePermissions(roleId, permission_ids, userId);
  return repo.getAllPermissionsWithRoleFlag(roleId);
}

async function toggleRolePermission({ roleId, permissionId, body, userId }) {
  const [role, perm] = await Promise.all([
    repo.getRoleById(roleId),
    knex('permissions').where('id', permissionId).first(),
  ]);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found.', 'کردار نہیں ملا۔', 404);
  if (!perm) throw new AppError('NOT_FOUND', 'Permission not found.', 'اجازت نہیں ملی۔', 404);

  await repo.toggleRolePermission(roleId, permissionId, body.is_granted, userId);
  return { role_id: roleId, permission_id: permissionId, is_granted: body.is_granted };
}

// ── Permissions ───────────────────────────────────────────────────────────────

async function listPermissions({ module: mod, is_active } = {}) {
  const rows = await repo.getPermissions({ module: mod, is_active });

  // Group by module
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.module]) grouped[row.module] = [];
    grouped[row.module].push({
      id:       row.id,
      key:      row.key,
      label:    row.label,
      label_ur: row.label_ur,
      action:   row.action,
      is_active: row.is_active,
    });
  }
  return grouped;
}

async function createPermission({ body }) {
  const { key, label, label_ur, module: mod, action, description } = body;

  // Validate key consistency
  if (key !== `${mod}.${action}`) {
    throw new AppError(
      'VALIDATION_ERROR',
      `key must equal "{module}.{action}" — expected '${mod}.${action}', got '${key}'.`,
      'key کا فارمیٹ درست نہیں ہے۔',
      400,
      'key',
    );
  }

  return repo.createPermission({ key, label, label_ur, module: mod, action, description });
}

async function updatePermission({ permissionId, body }) {
  const perm = await knex('permissions').where('id', permissionId).first();
  if (!perm) throw new AppError('NOT_FOUND', 'Permission not found.', 'اجازت نہیں ملی۔', 404);

  // key, module, action are immutable — silently drop them if accidentally sent
  const { label, label_ur, description, is_active } = body;
  const patch = {};
  if (label       !== undefined) patch.label       = label;
  if (label_ur    !== undefined) patch.label_ur    = label_ur;
  if (description !== undefined) patch.description = description;
  if (is_active   !== undefined) patch.is_active   = is_active;

  return repo.updatePermission(permissionId, patch);
}

// ── User permission overrides ─────────────────────────────────────────────────

async function getUserPermissionsDisplay({ userId }) {
  const [rolePerms, overrides, resolved] = await Promise.all([
    repo.getUserPermissionsForDisplay(userId),
    repo.getUserPermissionOverrides(userId),
    repo.getCachedPermissions(userId),
  ]);

  return {
    role_permissions: rolePerms,
    overrides,
    resolved: [...resolved].sort(),
  };
}

async function setUserPermissionOverride({ userId, body, grantedBy }) {
  const { permission_id, is_granted } = body;

  const perm = await knex('permissions').where('id', permission_id).first();
  if (!perm) throw new AppError('NOT_FOUND', 'Permission not found.', 'اجازت نہیں ملی۔', 404);

  const user = await knex('users').where('id', userId).first();
  if (!user) throw new AppError('NOT_FOUND', 'User not found.', 'صارف نہیں ملا۔', 404);

  await repo.setUserPermissionOverride(userId, permission_id, is_granted, grantedBy);
  return repo.getUserPermissionOverrides(userId);
}

async function removeUserPermissionOverride({ userId, permissionId }) {
  const user = await knex('users').where('id', userId).first();
  if (!user) throw new AppError('NOT_FOUND', 'User not found.', 'صارف نہیں ملا۔', 404);

  await repo.removeUserPermissionOverride(userId, permissionId);
}

module.exports = {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
  toggleRolePermission,
  listPermissions,
  createPermission,
  updatePermission,
  getUserPermissionsDisplay,
  setUserPermissionOverride,
  removeUserPermissionOverride,
};
