import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import { useRoles, useToggleRolePermission } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';

export default function RoleImpactPanel({ permission, onClose }) {
  const toast = useToast();
  const { data: rolesRaw = [], isLoading } = useRoles({ include: 'permissions' });
  const roles = Array.isArray(rolesRaw) ? rolesRaw : [];
  const { mutateAsync: togglePerm } = useToggleRolePermission();

  const [visible,  setVisible]  = useState(false);
  const [addRoleId, setAddRoleId] = useState('');
  const [busyIds,  setBusyIds]  = useState(new Set());

  // Slide in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  if (!permission) return null;

  // Which roles have this permission
  const rolesWithPerm = roles.filter((r) =>
    (r.permissions ?? []).some((p) => p.id === permission.id),
  );
  const rolesWithoutPerm = roles.filter((r) =>
    !(r.permissions ?? []).some((p) => p.id === permission.id),
  );

  async function handleRevoke(role) {
    setBusyIds((s) => new Set([...s, role.id]));
    try {
      await togglePerm({ roleId: role.id, permissionId: permission.id, isGranted: false });
      toast.success(`Revoked from ${role.name}`);
    } catch {
      toast.error('Failed to revoke permission');
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(role.id); return n; });
    }
  }

  async function handleAdd() {
    if (!addRoleId) return;
    const role = roles.find((r) => r.id === addRoleId);
    if (!role) return;
    setBusyIds((s) => new Set([...s, addRoleId]));
    try {
      await togglePerm({ roleId: addRoleId, permissionId: permission.id, isGranted: true });
      toast.success(`Granted to ${role.name}`);
      setAddRoleId('');
    } catch {
      toast.error('Failed to grant permission');
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(addRoleId); return n; });
    }
  }

  const panel = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 140,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          width: 380,
          background: 'var(--white)',
          borderLeft: '1px solid var(--sand-mid)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 150,
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--sand-mid)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
                Roles with this permission
              </div>
              <code style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--emerald)', background: 'var(--emerald-pale)', padding: '2px 7px', borderRadius: 4 }}>
                {permission.key}
              </code>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 20, padding: '2px 6px', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
            {rolesWithPerm.length} role{rolesWithPerm.length !== 1 ? 's' : ''} have this permission
          </div>
        </div>

        {/* Role list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner size={24} />
            </div>
          ) : rolesWithPerm.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-pale)' }}>
              No roles have this permission yet.
            </div>
          ) : (
            rolesWithPerm.map((role) => (
              <div
                key={role.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--sand)',
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: role.color ?? 'var(--sand-deep)', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{role.name}</div>
                  {role.is_system && (
                    <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>system role</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busyIds.has(role.id)}
                  onClick={() => handleRevoke(role)}
                  style={{
                    fontSize: 11, padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--red-light)',
                    background: 'var(--white)',
                    color: 'var(--red)',
                    cursor: busyIds.has(role.id) ? 'default' : 'pointer',
                    opacity: busyIds.has(role.id) ? 0.5 : 1,
                    fontWeight: 500,
                  }}
                >
                  {busyIds.has(role.id) ? '…' : 'Revoke'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add to role */}
        {rolesWithoutPerm.length > 0 && (
          <div style={{ borderTop: '1px solid var(--sand-mid)', padding: '14px 20px', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 8 }}>
              Add to role
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="f-select"
                value={addRoleId}
                onChange={(e) => setAddRoleId(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">— Select role —</option>
                {rolesWithoutPerm.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                disabled={!addRoleId || busyIds.has(addRoleId)}
                onClick={handleAdd}
              >
                {busyIds.has(addRoleId) ? '…' : 'Grant'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
