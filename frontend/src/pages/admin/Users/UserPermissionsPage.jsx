import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import { useUserPermissions, useRemoveUserPermissionOverride } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';
import { getUser } from '../../../api/users';
import UserProfileTabs from './UserProfileTabs';
import AddOverrideModal from './AddOverrideModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULE_LABELS = {
  org: 'Organisation', centers: 'Centers', courses: 'Courses',
  topics: 'Topics', classes: 'Classes', homework_criteria: 'Homework Criteria',
  enrollments: 'Enrollments', attendance: 'Attendance', progress: 'Progress',
  homework: 'Homework', assessments: 'Assessments', reports: 'Reports',
  users: 'Users', roles: 'Roles', permissions: 'Permissions',
};

// ── Small shared pieces ───────────────────────────────────────────────────────

function PermKeyChip({ text }) {
  return (
    <code style={{
      fontSize: 11, fontFamily: 'monospace',
      background: 'var(--sand)', color: 'var(--ink-mid)',
      padding: '1px 6px', borderRadius: 4,
      border: '1px solid var(--sand-mid)',
    }}>
      {text}
    </code>
  );
}

function SourceTag({ source }) {
  const map = {
    role:           { label: 'Role',         bg: 'var(--blue-light)',    color: 'var(--blue)' },
    override_grant: { label: 'Override ✓',   bg: 'var(--emerald-light)', color: 'var(--emerald)' },
    override_deny:  { label: 'Override ✗',   bg: 'var(--red-light)',     color: 'var(--red)' },
  };
  const s = map[source] ?? map.role;
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, ...s }}>
      {s.label}
    </span>
  );
}

function SectionCard({ title, count, children, action }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--sand-mid)', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: 'var(--sand-mid)', color: 'var(--ink-soft)', fontWeight: 500 }}>
            {count}
          </span>
        )}
        {action}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {children}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserPermissionsPage() {
  const { userId } = useParams();
  const toast = useToast();

  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn:  () => getUser(userId),
    staleTime: 60_000,
    enabled:  !!userId,
  });

  const { data: permData, isLoading } = useUserPermissions(userId);
  const { mutateAsync: removeOverride } = useRemoveUserPermissionOverride();

  const [addOpen,   setAddOpen]   = useState(false);
  const [busyIds,   setBusyIds]   = useState(new Set());
  const [expanded,  setExpanded]  = useState({});     // for resolved column groups
  const [auditOpen, setAuditOpen] = useState(false);

  // ── Derive data ─────────────────────────────────────────────────────────────

  const rolePermissions = permData?.role_permissions ?? [];
  const overrides       = permData?.overrides       ?? [];
  const resolved        = permData?.resolved        ?? [];

  // Roles that grant permissions to this user
  const assignedRoles = useMemo(
    () => [...new Set(rolePermissions.map((p) => p.granted_via_role).filter(Boolean))],
    [rolePermissions],
  );

  // Sets for quick lookups
  const rolePermKeys      = useMemo(() => new Set(rolePermissions.map((p) => p.key)), [rolePermissions]);
  const overrideGrantKeys = useMemo(() => new Set(overrides.filter((o) => o.is_granted).map((o) => o.key)), [overrides]);
  const overrideDenyKeys  = useMemo(() => new Set(overrides.filter((o) => !o.is_granted).map((o) => o.key)), [overrides]);

  // Column 2: extra grants (is_granted=true overrides — all explicitly set)
  const extraGrants  = overrides.filter((o) => o.is_granted);
  // Column 2: explicit denies (is_granted=false overrides)
  const explicitDenies = overrides.filter((o) => !o.is_granted);

  // Label lookup for resolved column (key → permission label data)
  const labelMap = useMemo(() => {
    const m = {};
    for (const p of rolePermissions) m[p.key] = p;
    for (const o of overrides)       m[o.key] = { ...m[o.key], ...o };
    return m;
  }, [rolePermissions, overrides]);

  // Column 3: all resolved keys + denied overrides, with source tag
  const resolvedView = useMemo(() => {
    const items = [
      ...resolved.map((key) => ({
        key,
        label:   labelMap[key]?.label ?? key,
        source:  overrideGrantKeys.has(key) ? 'override_grant' : 'role',
        denied:  false,
      })),
      ...explicitDenies.map((o) => ({
        key:    o.key,
        label:  o.label ?? o.key,
        source: 'override_deny',
        denied: true,
      })),
    ];
    // Sort: denied at bottom within each group
    return items.sort((a, b) => {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });
  }, [resolved, explicitDenies, overrideGrantKeys, labelMap]);

  // Group resolved by module
  const resolvedByModule = useMemo(() => {
    const g = {};
    for (const item of resolvedView) {
      const mod = item.key.split('.')[0] ?? 'other';
      if (!g[mod]) g[mod] = [];
      g[mod].push(item);
    }
    return g;
  }, [resolvedView]);

  // Audit trail from overrides (most recent first)
  const auditEntries = useMemo(() =>
    [...overrides]
      .filter((o) => o.granted_at)
      .sort((a, b) => new Date(b.granted_at) - new Date(a.granted_at)),
    [overrides],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRemove(key) {
    const perm = overrides.find((o) => o.key === key);
    if (!perm?.permission_id && !perm?.id) return;
    const permId = perm.permission_id ?? perm.id;
    setBusyIds((s) => new Set([...s, key]));
    try {
      await removeOverride({ userId, permissionId: permId });
      toast.success(`Override removed for ${key}`);
    } catch {
      toast.error('Failed to remove override');
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <UserProfileTabs userId={userId} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  const existingOverrideKeys = overrides.map((o) => o.key);

  return (
    <div>
      <UserProfileTabs userId={userId} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 6 }}>
          Permissions for {user?.full_name ?? '…'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-pale)' }}>Base roles:</span>
          {assignedRoles.length > 0
            ? assignedRoles.map((r) => (
                <span key={r} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'var(--sand-mid)', color: 'var(--ink-mid)', fontWeight: 500 }}>
                  {r}
                </span>
              ))
            : <span style={{ fontSize: 12, color: 'var(--ink-pale)' }}>none</span>}
          <span style={{ fontSize: 12, color: 'var(--ink-pale)', marginLeft: 8 }}>
            Resolved permissions: <strong>{resolved.length}</strong> total
          </span>
        </div>
      </div>

      {/* Three-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 14, marginBottom: 20 }}>

        {/* ── Column 1 — Inherited from roles ── */}
        <SectionCard title="Inherited from roles" count={rolePermissions.length}>
          {rolePermissions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--ink-pale)' }}>No role permissions.</div>
          ) : (
            rolePermissions.map((p, i) => (
              <div key={p.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '7px 14px',
                borderBottom: i < rolePermissions.length - 1 ? '1px solid var(--sand)' : 'none',
                opacity: 0.75,
              }}>
                <PermKeyChip text={p.key} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.3 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-pale)', marginTop: 2 }}>via {p.granted_via_role}</div>
                </div>
              </div>
            ))
          )}
        </SectionCard>

        {/* ── Column 2 — User overrides ── */}
        <SectionCard
          title="User overrides"
          count={overrides.length}
          action={
            <Can permission="roles.assign">
              <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} style={{ fontSize: 11, padding: '4px 10px' }}>
                + Add override
              </Button>
            </Can>
          }
        >
          {/* Extra grants */}
          {extraGrants.length > 0 && (
            <>
              <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 600, color: 'var(--emerald)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Extra grants
              </div>
              {extraGrants.map((o, i) => (
                <OverrideRow
                  key={o.key}
                  override={o}
                  isLast={i === extraGrants.length - 1 && explicitDenies.length === 0}
                  busy={busyIds.has(o.key)}
                  onRemove={() => handleRemove(o.key)}
                />
              ))}
            </>
          )}

          {/* Explicit denies */}
          {explicitDenies.length > 0 && (
            <>
              <div style={{ padding: `${extraGrants.length > 0 ? '10px' : '6px'} 14px 4px`, fontSize: 10, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Explicit denies
              </div>
              {explicitDenies.map((o, i) => (
                <OverrideRow
                  key={o.key}
                  override={o}
                  isLast={i === explicitDenies.length - 1}
                  busy={busyIds.has(o.key)}
                  onRemove={() => handleRemove(o.key)}
                />
              ))}
            </>
          )}

          {overrides.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--ink-pale)' }}>
              No user-specific overrides.
              <br />
              <span style={{ fontSize: 11 }}>User inherits all permissions from their roles.</span>
            </div>
          )}
        </SectionCard>

        {/* ── Column 3 — Resolved (final) ── */}
        <SectionCard title="Final permission set" count={resolved.length}>
          {Object.entries(resolvedByModule).map(([mod]) => {
            const items  = resolvedByModule[mod];
            const isOpen = expanded[mod] !== false;
            return (
              <div key={mod}>
                <div
                  onClick={() => setExpanded((p) => ({ ...p, [mod]: !isOpen }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', background: 'var(--sand)', borderBottom: '1px solid var(--sand-mid)', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                    {MODULE_LABELS[mod] ?? mod}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-pale)' }}>{items.length}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-pale)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && items.map((item, i) => (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px',
                    borderBottom: i < items.length - 1 ? '1px solid var(--sand)' : 'none',
                    opacity: item.denied ? 0.55 : 1,
                    textDecoration: item.denied ? 'line-through' : 'none',
                  }}>
                    <PermKeyChip text={item.key.split('.')[1]} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-mid)' }}>{item.label}</span>
                    <SourceTag source={item.source} />
                  </div>
                ))}
              </div>
            );
          })}
          {resolvedView.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--ink-pale)' }}>No permissions.</div>
          )}
        </SectionCard>
      </div>

      {/* ── Audit trail ── */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div
          onClick={() => setAuditOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>Permission history</span>
          <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{auditOpen ? '▲' : '▼'}</span>
        </div>

        {auditOpen && (
          auditEntries.length === 0 ? (
            <div style={{ padding: '16px', fontSize: 12, color: 'var(--ink-pale)', borderTop: '1px solid var(--sand-mid)' }}>No override history recorded.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid var(--sand-mid)' }}>
              <thead>
                <tr>
                  {['Date', 'Change', 'Type'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 16px 6px', borderBottom: '1px solid var(--sand-mid)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry, i) => (
                  <tr key={entry.key + i}>
                    <td style={{ padding: '8px 16px', fontSize: 12, color: 'var(--ink-pale)', borderBottom: i < auditEntries.length - 1 ? '1px solid var(--sand)' : 'none', whiteSpace: 'nowrap' }}>
                      {entry.granted_at ? new Date(entry.granted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '8px 16px', borderBottom: i < auditEntries.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      <PermKeyChip text={entry.key} />
                      <span style={{ fontSize: 12, color: 'var(--ink-mid)', marginLeft: 8 }}>{entry.label}</span>
                    </td>
                    <td style={{ padding: '8px 16px', borderBottom: i < auditEntries.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                        background: entry.is_granted ? 'var(--emerald-light)' : 'var(--red-light)',
                        color: entry.is_granted ? 'var(--emerald)' : 'var(--red)',
                      }}>
                        {entry.is_granted ? 'Grant override' : 'Deny override'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      <AddOverrideModal
        open={addOpen}
        userId={userId}
        existingOverrideKeys={existingOverrideKeys}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}

// ── Override row ──────────────────────────────────────────────────────────────

function OverrideRow({ override, isLast, busy, onRemove }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--sand)',
    }}>
      <PermKeyChip text={override.key} />
      <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-mid)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {override.label}
      </span>
      <span style={{
        fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0,
        background: override.is_granted ? 'var(--emerald-light)' : 'var(--red-light)',
        color:      override.is_granted ? 'var(--emerald)'       : 'var(--red)',
      }}>
        {override.is_granted ? 'Grant' : 'Deny'}
      </span>
      <Can permission="roles.assign">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          title="Remove override"
          style={{
            background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
            color: 'var(--ink-pale)', fontSize: 14, padding: '2px 5px',
            opacity: busy ? 0.4 : 1, lineHeight: 1, flexShrink: 0,
          }}
        >
          {busy ? '…' : '✕'}
        </button>
      </Can>
    </div>
  );
}
