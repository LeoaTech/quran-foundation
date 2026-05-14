import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/rbac';
import { useAuth } from './useAuth';

// ── Client-side permission checker ────────────────────────────────────────────
//
// usePermissions() reads the resolved permission set stored in AuthContext
// (fetched once after login from GET /users/:id/permissions).
//
// When permissions === null (not yet fetched, or fetch failed for non-admin
// users), all can() checks return false BUT the `loaded` flag is also false,
// so Can components and nav filters treat the state as "show everything".
//
// This ensures no UI flash or blank sidebar while permissions load.

export function usePermissions() {
  const { permissions } = useAuth(); // null | string[]

  const permSet = useMemo(() => new Set(permissions ?? []), [permissions]);
  const loaded  = permissions !== null;

  return {
    // Returns true if the user has the given permission key.
    can:     (key)      => loaded && permSet.has(key),
    // Returns true if the user has ANY of the given keys.
    canAny:  (...keys)  => loaded && keys.some((k) => permSet.has(k)),
    // Returns true if the user has ALL of the given keys.
    canAll:  (...keys)  => loaded && keys.every((k) => permSet.has(k)),
    // Full sorted list (empty array when not loaded or no permissions).
    permissions: permissions ?? [],
    // true once the first fetch attempt completes (success or failure).
    loaded,
  };
}

// ── Roles ──────────────────────────────────────────────────────────────────────

export function useRoles(params = {}) {
  return useQuery({
    queryKey: ['rbac-roles', params],
    queryFn:  () => api.getRoles(params),
    staleTime: 30_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, data }) => api.updateRole(roleId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-roles'] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-roles'] }),
  });
}

// ── Role permissions ───────────────────────────────────────────────────────────

export function useRolePermissions(roleId) {
  return useQuery({
    queryKey: ['rbac-role-perms', roleId],
    queryFn:  () => api.getRolePermissions(roleId),
    staleTime: 30_000,
    enabled:  !!roleId,
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }) => api.setRolePermissions(roleId, permissionIds),
    onSuccess: (_, { roleId }) => qc.invalidateQueries({ queryKey: ['rbac-role-perms', roleId] }),
  });
}

export function useToggleRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionId, isGranted }) =>
      api.toggleRolePermission(roleId, permissionId, isGranted),
    onSuccess: (_, { roleId }) => {
      qc.invalidateQueries({ queryKey: ['rbac-roles'] });
      qc.invalidateQueries({ queryKey: ['rbac-role-perms', roleId] });
    },
  });
}

// ── Permissions ───────────────────────────────────────────────────────────────

export function useAllPermissions(params = {}) {
  return useQuery({
    queryKey: ['rbac-all-permissions', params],
    queryFn:  () => api.getPermissions(params),
    staleTime: 60_000,
  });
}

export function useCreatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPermission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-all-permissions'] }),
  });
}

export function useUpdatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ permissionId, data }) => api.updatePermission(permissionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-all-permissions'] }),
  });
}
