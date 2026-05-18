import { useState, useMemo } from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import { useAllPermissions, useUpdatePermission, useRoles } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';
import RBACTabs from './RBACTabs';
import AddPermissionModal from './AddPermissionModal';
import EditPermissionModal from './EditPermissionModal';
import RoleImpactPanel from './RoleImpactPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_CHIPS = {
  view:           { bg: 'var(--blue-light)',    color: 'var(--blue)' },
  create:         { bg: 'var(--emerald-light)', color: 'var(--emerald)' },
  edit:           { bg: 'var(--gold-light)',    color: 'var(--amber)' },
  delete:         { bg: 'var(--red-light)',     color: 'var(--red)' },
  export:         { bg: 'var(--sand-mid)',      color: 'var(--ink-soft)' },
  assign:         { bg: 'var(--blue-light)',    color: 'var(--blue)' },
  mark:           { bg: 'var(--emerald-light)', color: 'var(--emerald)' },
  correct:        { bg: 'var(--gold-light)',    color: 'var(--amber)' },
  deactivate:     { bg: 'var(--red-light)',     color: 'var(--red)' },
  record_results: { bg: 'var(--sand-mid)',      color: 'var(--ink-soft)' },
  withdraw:       { bg: 'var(--red-light)',     color: 'var(--red)' },
  transfer:       { bg: 'var(--gold-light)',    color: 'var(--amber)' },
};

const MODULE_LABELS = {
  org: 'Organisation', centers: 'Centers', courses: 'Courses',
  topics: 'Topics', classes: 'Classes', homework_criteria: 'Homework Criteria',
  enrollments: 'Enrollments', attendance: 'Attendance', progress: 'Progress',
  homework: 'Homework', assessments: 'Assessments', reports: 'Reports',
  users: 'Users', roles: 'Roles', permissions: 'Permissions',
};

// ── Roles tooltip chip ────────────────────────────────────────────────────────

function RolesChip({ permId, rolesByPermId, onClick }) {
  const [hovered, setHovered] = useState(false);
  const roles = rolesByPermId[permId] ?? [];

  if (roles.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>no roles</span>;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize: 11, padding: '2px 9px', borderRadius: 999,
          background: 'var(--blue-light)', color: 'var(--blue)',
          border: 'none', cursor: 'pointer', fontWeight: 500,
        }}
      >
        {roles.length} role{roles.length > 1 ? 's' : ''}
      </button>
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          background: 'var(--ink)', color: 'var(--white)',
          padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          fontSize: 11, whiteSpace: 'nowrap', zIndex: 100, marginBottom: 4,
          boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
        }}>
          {roles.map((r) => r.name).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Status toggle ─────────────────────────────────────────────────────────────

function StatusDot({ isActive, onToggle, loading }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.5 : 1, padding: 0,
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: isActive ? 'var(--emerald-bright)' : 'var(--sand-deep)',
        display: 'inline-block',
      }} />
      <span style={{ fontSize: 11, color: isActive ? 'var(--emerald)' : 'var(--ink-pale)' }}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const toast = useToast();

  const { data: groupedPerms, isLoading: permsLoading } = useAllPermissions();
  const { data: rolesRaw = [] }                          = useRoles({ include: 'permissions' });
  const roles                                            = Array.isArray(rolesRaw) ? rolesRaw : [];
  const { mutateAsync: updatePermission }                = useUpdatePermission();

  // Flatten grouped → [{...perm, module}]
  const flatPerms = useMemo(() => {
    if (!groupedPerms) return [];
    return Object.entries(groupedPerms).flatMap(([mod, perms]) =>
      perms.map((p) => ({ ...p, module: mod })),
    );
  }, [groupedPerms]);

  // Derive filter options
  const modules = useMemo(() => [...new Set(flatPerms.map((p) => p.module))].sort(), [flatPerms]);
  const actions = useMemo(() => [...new Set(flatPerms.map((p) => p.action))].sort(), [flatPerms]);
  const existingKeys = useMemo(() => flatPerms.map((p) => p.key), [flatPerms]);

  // Compute role map: permId → [role]
  const rolesByPermId = useMemo(() => {
    const map = {};
    for (const role of roles) {
      for (const perm of (role.permissions ?? [])) {
        if (!map[perm.id]) map[perm.id] = [];
        map[perm.id].push(role);
      }
    }
    return map;
  }, [roles]);

  // Filter state
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'all'
  const [search,       setSearch]       = useState('');
  const [expanded,     setExpanded]     = useState({}); // default all open

  // Modal / panel state
  const [addOpen,      setAddOpen]      = useState(false);
  const [editPerm,     setEditPerm]     = useState(null);
  const [impactPerm,   setImpactPerm]   = useState(null);
  const [busyIds,      setBusyIds]      = useState(new Set());

  // Filtered + grouped
  const filteredGrouped = useMemo(() => {
    const q = search.toLowerCase();
    const result = {};
    for (const p of flatPerms) {
      if (moduleFilter && p.module !== moduleFilter) continue;
      if (actionFilter && p.action !== actionFilter) continue;
      if (statusFilter === 'active' && !p.is_active) continue;
      if (q && !p.key.toLowerCase().includes(q) && !p.label.toLowerCase().includes(q)) continue;
      if (!result[p.module]) result[p.module] = [];
      result[p.module].push(p);
    }
    return result;
  }, [flatPerms, moduleFilter, actionFilter, statusFilter, search]);

  const totalFiltered = Object.values(filteredGrouped).reduce((s, a) => s + a.length, 0);

  async function handleToggleStatus(perm) {
    setBusyIds((s) => new Set([...s, perm.id]));
    try {
      await updatePermission({ permissionId: perm.id, data: { is_active: !perm.is_active } });
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(perm.id); return n; });
    }
  }

  const thStyle = {
    textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--ink-pale)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '7px 14px 6px', borderBottom: '1px solid var(--sand-mid)',
  };

  return (
    <div>
      {/* Tab bar */}
      <RBACTabs />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Permissions
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {permsLoading ? 'Loading…' : `${flatPerms.length} total permissions across ${modules.length} modules`}
          </p>
        </div>
        <Can permission="permissions.manage">
          <Button variant="primary" onClick={() => setAddOpen(true)}>+ Add permission</Button>
        </Can>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select
          className="f-select"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>{MODULE_LABELS[m] ?? m}</option>
          ))}
        </select>
        <select
          className="f-select"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ width: 140 }}
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--sand-deep)', overflow: 'hidden' }}>
          {[['active', 'Active only'], ['all', 'All']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: statusFilter === val ? 'var(--ink)' : 'var(--white)',
                color: statusFilter === val ? 'var(--white)' : 'var(--ink-soft)',
                border: 'none', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="f-input"
          type="search"
          placeholder="Search key or label…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        {(moduleFilter || actionFilter || search) && (
          <button
            type="button"
            onClick={() => { setModuleFilter(''); setActionFilter(''); setSearch(''); }}
            style={{ fontSize: 12, color: 'var(--ink-pale)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear filters
          </button>
        )}
        {search || moduleFilter || actionFilter ? (
          <span style={{ fontSize: 12, color: 'var(--ink-pale)', marginLeft: 'auto' }}>
            {totalFiltered} result{totalFiltered !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {/* Permissions table */}
      {permsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {Object.keys(filteredGrouped).length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-pale)', fontSize: 13 }}>
              No permissions match your filters.
            </div>
          ) : (
            Object.entries(filteredGrouped).map(([mod, perms]) => {
              const isOpen = expanded[mod] !== false;
              return (
                <div key={mod} style={{ borderBottom: '1px solid var(--sand-mid)' }}>
                  {/* Module group header */}
                  <div
                    onClick={() => setExpanded((prev) => ({ ...prev, [mod]: !isOpen }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', background: 'var(--sand)',
                      cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                      {MODULE_LABELS[mod] ?? mod}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                      background: 'var(--sand-mid)', color: 'var(--ink-soft)',
                    }}>
                      {perms.length}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Permission rows */}
                  {isOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Key</th>
                          <th style={thStyle}>Label</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>اردو</th>
                          <th style={thStyle}>Action</th>
                          <th style={thStyle}>Roles</th>
                          <th style={thStyle}>Status</th>
                          <th style={{ ...thStyle, width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {perms.map((perm, i) => {
                          const isLast  = i === perms.length - 1;
                          const chip    = ACTION_CHIPS[perm.action] ?? { bg: 'var(--sand-mid)', color: 'var(--ink-soft)' };
                          const loading = busyIds.has(perm.id);
                          return (
                            <tr
                              key={perm.id}
                              style={{ opacity: perm.is_active ? 1 : 0.55 }}
                            >
                              <td style={{ padding: '9px 14px', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                <code style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ink-mid)' }}>
                                  {perm.key}
                                </code>
                              </td>
                              <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                {perm.label}
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 13, direction: 'rtl', color: 'var(--ink-soft)', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                {perm.label_ur ?? '—'}
                              </td>
                              <td style={{ padding: '9px 14px', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, ...chip }}>
                                  {perm.action}
                                </span>
                              </td>
                              <td style={{ padding: '9px 14px', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                <RolesChip
                                  permId={perm.id}
                                  rolesByPermId={rolesByPermId}
                                  onClick={() => setImpactPerm(perm)}
                                />
                              </td>
                              <td style={{ padding: '9px 14px', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                <StatusDot
                                  isActive={perm.is_active}
                                  onToggle={() => handleToggleStatus(perm)}
                                  loading={loading}
                                />
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', borderBottom: isLast ? 'none' : '1px solid var(--sand)' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditPerm(perm)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}
                                  title="Edit permission"
                                >
                                  ✎
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modals & panels */}
      <AddPermissionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingKeys={existingKeys}
      />
      <EditPermissionModal
        open={!!editPerm}
        permission={editPerm}
        onClose={() => setEditPerm(null)}
      />
      {impactPerm && (
        <RoleImpactPanel
          permission={impactPerm}
          onClose={() => setImpactPerm(null)}
        />
      )}
    </div>
  );
}
