import { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import { useRoles, useRolePermissions, useToggleRolePermission, useSetRolePermissions } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';
import CreateRoleModal from './CreateRoleModal';
import EditRoleModal   from './EditRoleModal';
import DeleteRoleModal from './DeleteRoleModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULE_ICONS = {
  org: '⊙', centers: '⊙', courses: '◈', topics: '◉',
  classes: '▦', homework_criteria: '☑', enrollments: '○',
  attendance: '☑', progress: '◈', homework: '◉',
  assessments: '▦', reports: '▦', users: '○',
  roles: '⊞', permissions: '⚙',
};

const MODULE_LABELS = {
  org: 'Organisation', centers: 'Centers', courses: 'Courses',
  topics: 'Topics', classes: 'Classes', homework_criteria: 'Homework Criteria',
  enrollments: 'Enrollments', attendance: 'Attendance', progress: 'Progress',
  homework: 'Homework', assessments: 'Assessments', reports: 'Reports',
  users: 'Users', roles: 'Roles', permissions: 'Permissions',
};

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, loading }) {
  return (
    <button
      type="button"
      onClick={() => !loading && onChange(!checked)}
      aria-pressed={checked}
      style={{
        position: 'relative',
        width: 40, height: 22,
        borderRadius: 11,
        background: checked ? 'var(--emerald)' : 'var(--sand-deep)',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      {loading ? (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: 'white', opacity: 0.8,
        }}>
          ···
        </span>
      ) : (
        <span style={{
          position: 'absolute',
          top: 3, left: checked ? 21 : 3,
          width: 16, height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.18s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      )}
    </button>
  );
}

// ── Role card (left panel) ────────────────────────────────────────────────────

function RoleCard({ role, selected, onClick }) {
  const isSelected = selected;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        borderLeft: `3px solid ${isSelected ? (role.color ?? 'var(--emerald)') : 'transparent'}`,
        background: isSelected ? 'var(--sand)' : 'transparent',
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--sand)'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
          background: role.color ?? 'var(--emerald)', flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{role.name}</span>
        {role.is_system && (
          <span style={{ fontSize: 10, color: 'var(--ink-pale)', marginLeft: 'auto', flexShrink: 0 }}>🔒</span>
        )}
      </div>
      {role.label_ur && (
        <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', direction: 'rtl', color: 'var(--ink-soft)', marginBottom: 4 }}>
          {role.label_ur}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--ink-pale)' }}>
        <span>{role.user_count ?? 0} users</span>
        <span>{role.permission_count ?? 0} permissions</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RBACPage() {
  const toast = useToast();

  const { data: rolesRaw = [], isLoading: rolesLoading } = useRoles({ include: 'permissions' });
  const roles = Array.isArray(rolesRaw) ? rolesRaw : [];

  const [selectedRoleId, setSelectedRoleId]     = useState(null);
  const [createOpen,     setCreateOpen]          = useState(false);
  const [editRole,       setEditRole]            = useState(null);
  const [deleteRole,     setDeleteRole]          = useState(null);

  // Permission matrix state
  const [localGranted,  setLocalGranted]  = useState(new Set()); // current UI state (Set of perm IDs)
  const [initGranted,   setInitGranted]   = useState(new Set()); // last-synced server state
  const [inFlight,      setInFlight]      = useState(new Set()); // per-toggle spinner set
  const [expanded,      setExpanded]      = useState({});        // module collapse state
  const [isSaving,      setIsSaving]      = useState(false);

  const { data: permData, isLoading: permsLoading } = useRolePermissions(selectedRoleId);
  const { mutateAsync: togglePermission }           = useToggleRolePermission();
  const { mutateAsync: saveAllPermissions }         = useSetRolePermissions();

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // Initialize local state when role or server data changes
  useEffect(() => {
    if (!permData) return;
    const ids = new Set(permData.filter((p) => p.is_granted).map((p) => p.id));
    setLocalGranted(ids);
    setInitGranted(new Set(ids));
    setExpanded({});
  }, [selectedRoleId, permData]);

  // Group permissions by module
  const grouped = useMemo(() => {
    if (!permData) return {};
    const g = {};
    for (const p of permData) {
      if (!g[p.module]) g[p.module] = [];
      g[p.module].push(p);
    }
    return g;
  }, [permData]);

  // Count pending changes (only Grant/Revoke-all changes; individual toggles auto-sync initGranted)
  const pendingCount = useMemo(() => {
    let n = 0;
    for (const p of (permData ?? [])) {
      if (localGranted.has(p.id) !== initGranted.has(p.id)) n++;
    }
    return n;
  }, [localGranted, initGranted, permData]);

  // Individual toggle
  const handleToggle = useCallback(async (perm) => {
    const wasGranted = localGranted.has(perm.id);
    const newGranted = !wasGranted;

    // Optimistic update
    setLocalGranted((prev) => { const s = new Set(prev); newGranted ? s.add(perm.id) : s.delete(perm.id); return s; });
    setInFlight((prev) => new Set([...prev, perm.id]));

    try {
      await togglePermission({ roleId: selectedRoleId, permissionId: perm.id, isGranted: newGranted });
      // Sync initGranted so this no longer counts as pending
      setInitGranted((prev) => { const s = new Set(prev); newGranted ? s.add(perm.id) : s.delete(perm.id); return s; });
    } catch {
      // Revert
      setLocalGranted((prev) => { const s = new Set(prev); wasGranted ? s.add(perm.id) : s.delete(perm.id); return s; });
      toast.error('Failed to update permission');
    } finally {
      setInFlight((prev) => { const s = new Set(prev); s.delete(perm.id); return s; });
    }
  }, [localGranted, selectedRoleId, togglePermission, toast]);

  // Grant / revoke all in a module
  const handleGrantAll  = (modulePerms) => setLocalGranted((prev) => { const s = new Set(prev); modulePerms.forEach((p) => s.add(p.id)); return s; });
  const handleRevokeAll = (modulePerms) => {
    if (!window.confirm(`Revoke all permissions in this module from "${selectedRole?.name}"?`)) return;
    setLocalGranted((prev) => { const s = new Set(prev); modulePerms.forEach((p) => s.delete(p.id)); return s; });
  };

  // Save all pending changes
  async function handleSaveAll() {
    setIsSaving(true);
    try {
      await saveAllPermissions({ roleId: selectedRoleId, permissionIds: [...localGranted] });
      setInitGranted(new Set(localGranted));
      toast.success('Permissions saved');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  }

  // Discard pending
  function handleDiscard() {
    setLocalGranted(new Set(initGranted));
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Roles & Permissions
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Manage role definitions and their permission assignments
        </p>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left panel — roles list ── */}
        <div style={{
          position: 'sticky', top: 0, alignSelf: 'start',
          maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
          background: 'var(--white)', border: '1px solid var(--sand-mid)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {/* Roles header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--sand-mid)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Roles</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
              style={{ fontSize: 11, padding: '5px 12px' }}
            >
              + New role
            </Button>
          </div>

          {rolesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner size={24} /></div>
          ) : (
            <div>
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  selected={role.id === selectedRoleId}
                  onClick={() => setSelectedRoleId(role.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel — permission matrix ── */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {!selectedRole ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-pale)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>⊞</div>
              Select a role to view and manage its permissions
            </div>
          ) : (
            <>
              {/* Role header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--sand-mid)' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: selectedRole.color ?? 'var(--emerald)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{selectedRole.name}</span>
                    {selectedRole.is_system && (
                      <span style={{ fontSize: 10, background: 'var(--sand)', color: 'var(--ink-soft)', padding: '2px 7px', borderRadius: 999, fontWeight: 500 }}>system</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: 1 }}>
                    {selectedRole.user_count} users · {selectedRole.permission_count} permissions
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditRole(selectedRole)} style={{ fontSize: 11 }}>
                  ✎ Edit
                </Button>
                {!selectedRole.is_system && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteRole(selectedRole)}
                    style={{ fontSize: 11, borderColor: 'var(--red-light)', color: 'var(--red)' }}
                  >
                    🗑 Delete
                  </Button>
                )}
              </div>

              {permsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><LoadingSpinner size={28} /></div>
              ) : (
                <>
                  {/* Summary */}
                  <div style={{ padding: '10px 20px 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                    {localGranted.size} permissions across {Object.keys(grouped).length} modules
                  </div>

                  {/* Module sections */}
                  {Object.entries(grouped).map(([mod, perms]) => {
                    const grantedInModule = perms.filter((p) => localGranted.has(p.id)).length;
                    const allGranted = grantedInModule === perms.length;
                    const isOpen = expanded[mod] !== false; // default open

                    return (
                      <div key={mod} style={{ borderBottom: '1px solid var(--sand)' }}>
                        {/* Module header */}
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 20px', cursor: 'pointer',
                            background: 'var(--sand)',
                          }}
                          onClick={() => setExpanded((prev) => ({ ...prev, [mod]: !isOpen }))}
                        >
                          <span style={{ fontSize: 14, opacity: 0.6 }}>{MODULE_ICONS[mod] ?? '◈'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', flex: 1 }}>
                            {MODULE_LABELS[mod] ?? mod}
                          </span>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                            background: grantedInModule === perms.length ? 'var(--emerald-light)' : grantedInModule === 0 ? 'var(--sand-mid)' : 'var(--gold-light)',
                            color: grantedInModule === perms.length ? 'var(--emerald)' : grantedInModule === 0 ? 'var(--ink-pale)' : 'var(--amber)',
                          }}>
                            {grantedInModule}/{perms.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleGrantAll(perms); }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--emerald-light)', background: 'var(--emerald-pale)', color: 'var(--emerald)', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Grant all
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRevokeAll(perms); }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sand-deep)', background: 'var(--white)', color: 'var(--ink-soft)', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Revoke all
                          </button>
                          <span style={{ fontSize: 11, color: 'var(--ink-pale)', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                        </div>

                        {/* Permission rows */}
                        {isOpen && (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {['Permission', 'اردو', 'Action', ''].map((h) => (
                                  <th key={h} style={{
                                    textAlign: h === 'اردو' ? 'right' : 'left',
                                    fontSize: 10, fontWeight: 500, color: 'var(--ink-pale)',
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                    padding: '6px 16px 5px',
                                    borderBottom: '1px solid var(--sand)',
                                  }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {perms.map((perm, i) => {
                                const granted  = localGranted.has(perm.id);
                                const loading  = inFlight.has(perm.id);
                                const isLast   = i === perms.length - 1;
                                return (
                                  <tr key={perm.id} style={{ background: granted ? 'rgba(42,170,132,0.03)' : 'transparent' }}>
                                    <td style={{ padding: '9px 16px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: isLast ? 'none' : '1px solid var(--sand)', fontWeight: granted ? 500 : 400 }}>
                                      {perm.label}
                                    </td>
                                    <td style={{ padding: '9px 16px', fontSize: 13, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', color: 'var(--ink-soft)', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                      {perm.label_ur ?? '—'}
                                    </td>
                                    <td style={{ padding: '9px 16px', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                      <span style={{
                                        fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                                        background: 'var(--sand-mid)', color: 'var(--ink-soft)',
                                      }}>
                                        {perm.action}
                                      </span>
                                    </td>
                                    <td style={{ padding: '9px 16px', textAlign: 'right', borderBottom: isLast ? 'none' : '1px solid var(--sand)', width: 60 }}>
                                      <Toggle
                                        checked={granted}
                                        onChange={() => handleToggle(perm)}
                                        loading={loading}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}

                  {/* Unsaved changes bar */}
                  {pendingCount > 0 && (
                    <div style={{
                      position: 'sticky', bottom: 0,
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 20px',
                      background: 'var(--ink)',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                        {pendingCount} unsaved change{pendingCount > 1 ? 's' : ''}
                      </span>
                      <div style={{ flex: 1 }} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDiscard}
                        style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', fontSize: 12 }}
                      >
                        Discard
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        style={{ fontSize: 12 }}
                      >
                        {isSaving ? 'Saving…' : 'Save all'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateRoleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingRoles={roles}
        onCreated={(id) => setSelectedRoleId(id)}
      />
      <EditRoleModal
        open={!!editRole}
        role={editRole}
        onClose={() => setEditRole(null)}
      />
      <DeleteRoleModal
        open={!!deleteRole}
        role={deleteRole}
        onClose={() => setDeleteRole(null)}
        onDeleted={() => {
          if (selectedRoleId === deleteRole?.id) setSelectedRoleId(null);
        }}
      />
    </div>
  );
}
