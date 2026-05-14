const service = require('../services/rbac.service');

// ── Roles ─────────────────────────────────────────────────────────────────────

async function listRoles(req, res, next) {
  try {
    res.json(await service.listRoles({ include: req.query.include }));
  } catch (err) { next(err); }
}

async function getRole(req, res, next) {
  try {
    res.json(await service.getRole(req.params.roleId));
  } catch (err) { next(err); }
}

async function createRole(req, res, next) {
  try {
    res.status(201).json(await service.createRole({ body: req.body, userId: req.user.id }));
  } catch (err) { next(err); }
}

async function updateRole(req, res, next) {
  try {
    res.json(await service.updateRole({ roleId: req.params.roleId, body: req.body }));
  } catch (err) { next(err); }
}

async function deleteRole(req, res, next) {
  try {
    await service.deleteRole({ roleId: req.params.roleId });
    res.status(204).end();
  } catch (err) { next(err); }
}

// ── Role permissions ──────────────────────────────────────────────────────────

async function getRolePermissions(req, res, next) {
  try {
    res.json(await service.getRolePermissions(req.params.roleId));
  } catch (err) { next(err); }
}

async function setRolePermissions(req, res, next) {
  try {
    res.json(await service.setRolePermissions({
      roleId: req.params.roleId,
      body:   req.body,
      userId: req.user.id,
    }));
  } catch (err) { next(err); }
}

async function toggleRolePermission(req, res, next) {
  try {
    res.json(await service.toggleRolePermission({
      roleId:       req.params.roleId,
      permissionId: req.params.permissionId,
      body:         req.body,
      userId:       req.user.id,
    }));
  } catch (err) { next(err); }
}

// ── Permissions ───────────────────────────────────────────────────────────────

async function listPermissions(req, res, next) {
  try {
    const { module: mod, is_active } = req.query;
    res.json(await service.listPermissions({
      module:    mod,
      is_active: is_active === undefined ? undefined : is_active === 'true',
    }));
  } catch (err) { next(err); }
}

async function createPermission(req, res, next) {
  try {
    res.status(201).json(await service.createPermission({ body: req.body }));
  } catch (err) { next(err); }
}

async function updatePermission(req, res, next) {
  try {
    res.json(await service.updatePermission({ permissionId: req.params.permissionId, body: req.body }));
  } catch (err) { next(err); }
}

// ── User permission overrides ─────────────────────────────────────────────────

async function getUserPermissions(req, res, next) {
  try {
    res.json(await service.getUserPermissionsDisplay({ userId: req.params.userId }));
  } catch (err) { next(err); }
}

async function setUserPermissionOverride(req, res, next) {
  try {
    res.status(201).json(await service.setUserPermissionOverride({
      userId:    req.params.userId,
      body:      req.body,
      grantedBy: req.user.id,
    }));
  } catch (err) { next(err); }
}

async function removeUserPermissionOverride(req, res, next) {
  try {
    await service.removeUserPermissionOverride({
      userId:       req.params.userId,
      permissionId: req.params.permissionId,
    });
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = {
  listRoles, getRole, createRole, updateRole, deleteRole,
  getRolePermissions, setRolePermissions, toggleRolePermission,
  listPermissions, createPermission, updatePermission,
  getUserPermissions, setUserPermissionOverride, removeUserPermissionOverride,
};
