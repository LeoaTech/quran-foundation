import { useState, useMemo } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import { useAllPermissions, useSetUserPermissionOverride } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';

const MODULE_LABELS = {
  org: 'Organisation', centers: 'Centers', courses: 'Courses',
  topics: 'Topics', classes: 'Classes', homework_criteria: 'Homework Criteria',
  enrollments: 'Enrollments', attendance: 'Attendance', progress: 'Progress',
  homework: 'Homework', assessments: 'Assessments', reports: 'Reports',
  users: 'Users', roles: 'Roles', permissions: 'Permissions',
};

export default function AddOverrideModal({ open, userId, existingOverrideKeys = [], onClose }) {
  const toast = useToast();
  const { data: groupedPerms }           = useAllPermissions({ is_active: true });
  const { mutateAsync: setOverride }     = useSetUserPermissionOverride();

  const [permissionId, setPermissionId] = useState('');
  const [isGranted,    setIsGranted]    = useState(true);
  const [search,       setSearch]       = useState('');
  const [busy,         setBusy]         = useState(false);

  // Flatten all permissions for the selector
  const allPerms = useMemo(() => {
    if (!groupedPerms) return [];
    return Object.entries(groupedPerms).flatMap(([mod, perms]) =>
      perms.map((p) => ({ ...p, module: mod })),
    );
  }, [groupedPerms]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? allPerms.filter((p) => p.key.includes(q) || p.label.toLowerCase().includes(q))
      : allPerms;
  }, [allPerms, search]);

  // Group filtered permissions by module for the select
  const filteredGrouped = useMemo(() => {
    const g = {};
    for (const p of filtered) {
      if (!g[p.module]) g[p.module] = [];
      g[p.module].push(p);
    }
    return g;
  }, [filtered]);

  function reset() {
    setPermissionId(''); setIsGranted(true); setSearch('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!permissionId) return;
    setBusy(true);
    try {
      await setOverride({ userId, permissionId, isGranted });
      toast.success(`Override ${isGranted ? 'grant' : 'deny'} saved`);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save override');
    } finally {
      setBusy(false);
    }
  }

  const selectedPerm = allPerms.find((p) => p.id === permissionId);
  const isUpdate     = selectedPerm && existingOverrideKeys.includes(selectedPerm.key);

  return (
    <Modal open={open} title="Add permission override" size="md" onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        {/* Permission select */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Permission</label>
          <input
            className="f-input"
            type="search"
            placeholder="Search by key or label…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <select
            className="f-select"
            value={permissionId}
            onChange={(e) => setPermissionId(e.target.value)}
            required
            size={8}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
          >
            <option value="">— Select permission —</option>
            {Object.entries(filteredGrouped).map(([mod, perms]) => (
              <optgroup key={mod} label={MODULE_LABELS[mod] ?? mod}>
                {perms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key}  ({p.label})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedPerm && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-soft)' }}>
              {selectedPerm.label}
              {isUpdate && (
                <span style={{ marginLeft: 8, color: 'var(--amber)', fontWeight: 500 }}>
                  — will update existing override
                </span>
              )}
            </div>
          )}
        </div>

        {/* Grant / Deny toggle */}
        <div style={{ marginBottom: 24 }}>
          <label style={lbl}>Override type</label>
          <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--sand-deep)', overflow: 'hidden', width: 'fit-content' }}>
            {[
              [true,  'Grant', 'var(--emerald-light)',  'var(--emerald)', '✓'],
              [false, 'Deny',  'var(--red-light)',       'var(--red)',    '✕'],
            ].map(([val, label_, bg, color, icon]) => (
              <button
                key={label_}
                type="button"
                onClick={() => setIsGranted(val)}
                style={{
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  background: isGranted === val ? bg : 'var(--white)',
                  color: isGranted === val ? color : 'var(--ink-soft)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{icon}</span> {label_}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
            {isGranted
              ? 'User gains this permission even if their role doesn\'t have it.'
              : 'User loses this permission even if their role grants it.'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" onClick={handleClose} type="button">Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !permissionId}
            style={!isGranted ? { background: 'var(--red)', boxShadow: '0 2px 8px rgba(192,57,43,0.25)' } : {}}
          >
            {busy ? 'Saving…' : isGranted ? 'Grant override' : 'Deny override'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const lbl = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'var(--ink-mid)', marginBottom: 6, letterSpacing: '0.02em',
};
