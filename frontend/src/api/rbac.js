import client from './client';

// ── Roles ──────────────────────────────────────────────────────────────────────
export const getRoles = (params = {}) =>
  client.get('/rbac/roles', { params }).then((r) => r.data);

export const createRole = (data) =>
  client.post('/rbac/roles', data).then((r) => r.data);

export const updateRole = (roleId, data) =>
  client.patch(`/rbac/roles/${roleId}`, data).then((r) => r.data);

export const deleteRole = (roleId) =>
  client.delete(`/rbac/roles/${roleId}`);

// ── Role permissions ───────────────────────────────────────────────────────────
// Returns ALL permissions with is_granted flag for this role
export const getRolePermissions = (roleId) =>
  client.get(`/rbac/roles/${roleId}/permissions`).then((r) => r.data);

export const setRolePermissions = (roleId, permissionIds) =>
  client.put(`/rbac/roles/${roleId}/permissions`, { permission_ids: permissionIds }).then((r) => r.data);

export const toggleRolePermission = (roleId, permissionId, isGranted) =>
  client.patch(`/rbac/roles/${roleId}/permissions/${permissionId}`, { is_granted: isGranted }).then((r) => r.data);

// ── Permissions ────────────────────────────────────────────────────────────────
export const getPermissions = (params = {}) =>
  client.get('/rbac/permissions', { params }).then((r) => r.data);

export const createPermission = (data) =>
  client.post('/rbac/permissions', data).then((r) => r.data);

export const updatePermission = (permissionId, data) =>
  client.patch(`/rbac/permissions/${permissionId}`, data).then((r) => r.data);

// ── User permission overrides ──────────────────────────────────────────────────
export const getUserPermissions = (userId) =>
  client.get(`/users/${userId}/permissions`).then((r) => r.data);

export const setUserPermissionOverride = (userId, data) =>
  client.post(`/users/${userId}/permissions`, data).then((r) => r.data);

export const removeUserPermissionOverride = (userId, permissionId) =>
  client.delete(`/users/${userId}/permissions/${permissionId}`);
