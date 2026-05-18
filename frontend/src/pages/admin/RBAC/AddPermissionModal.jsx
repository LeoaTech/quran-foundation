import { useState, useMemo } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useCreatePermission, useToggleRolePermission, useRoles } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';

const PREDEFINED_MODULES = [
  'org', 'centers', 'courses', 'topics', 'classes', 'homework_criteria',
  'enrollments', 'attendance', 'progress', 'homework', 'assessments',
  'reports', 'users', 'roles', 'permissions',
];

const PREDEFINED_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'export', 'assign',
  'mark', 'correct', 'deactivate', 'record_results', 'withdraw', 'transfer',
];

const SNAKE_RE = /^[a-z][a-z0-9_]*$/;

export default function AddPermissionModal({ open, onClose, existingKeys = [] }) {
  const toast = useToast();
  const { mutateAsync: createPermission } = useCreatePermission();
  const { mutateAsync: togglePerm }       = useToggleRolePermission();
  const { data: rolesRaw = [] }           = useRoles();
  const roles                             = Array.isArray(rolesRaw) ? rolesRaw : [];

  const [module,       setModule]       = useState('');
  const [customModule, setCustomModule] = useState('');
  const [action,       setAction]       = useState('');
  const [customAction, setCustomAction] = useState('');
  const [label,        setLabel]        = useState('');
  const [labelUr,      setLabelUr]      = useState('');
  const [description,  setDescription]  = useState('');
  const [assignRoles,  setAssignRoles]  = useState(new Set());
  const [busy,         setBusy]         = useState(false);

  const effectiveMod    = module === '__new__' ? customModule.trim() : module;
  const effectiveAction = action === '__custom__' ? customAction.trim() : action;
  const generatedKey    = effectiveMod && effectiveAction ? `${effectiveMod}.${effectiveAction}` : '';
  const keyExists       = existingKeys.includes(generatedKey);
  const keyValid        = generatedKey && SNAKE_RE.test(effectiveMod) && SNAKE_RE.test(effectiveAction);

  function reset() {
    setModule(''); setCustomModule(''); setAction(''); setCustomAction('');
    setLabel(''); setLabelUr(''); setDescription(''); setAssignRoles(new Set());
  }

  function handleClose() { reset(); onClose(); }

  function toggleRole(roleId) {
    setAssignRoles((prev) => {
      const next = new Set(prev);
      next.has(roleId) ? next.delete(roleId) : next.add(roleId);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!keyValid || keyExists || !label.trim()) return;
    setBusy(true);
    try {
      const newPerm = await createPermission({
        key: generatedKey, label, label_ur: labelUr, description,
        module: effectiveMod, action: effectiveAction,
      });

      // Assign to selected roles
      const roleIds = [...assignRoles];
      await Promise.all(roleIds.map((roleId) =>
        togglePerm({ roleId, permissionId: newPerm.id, isGranted: true }),
      ));

      const msg = roleIds.length > 0
        ? `Permission '${generatedKey}' created and assigned to ${roleIds.length} role${roleIds.length > 1 ? 's' : ''}`
        : `Permission '${generatedKey}' created`;
      toast.success(msg);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to create permission');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Add permission" size="md" onClose={handleClose}>
      <form onSubmit={handleSubmit}>

        {/* Module + Action */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Module</label>
            <select
              className="f-select"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">— Select module —</option>
              {PREDEFINED_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value="__new__">— New module… —</option>
            </select>
            {module === '__new__' && (
              <input
                className="f-input"
                value={customModule}
                onChange={(e) => setCustomModule(e.target.value.toLowerCase())}
                placeholder="new_module_name"
                style={{ width: '100%', marginTop: 8, fontFamily: 'monospace' }}
              />
            )}
          </div>
          <div>
            <label style={lbl}>Action</label>
            <select
              className="f-select"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">— Select action —</option>
              {PREDEFINED_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value="__custom__">— Custom… —</option>
            </select>
            {action === '__custom__' && (
              <input
                className="f-input"
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value.toLowerCase())}
                placeholder="custom_action"
                style={{ width: '100%', marginTop: 8, fontFamily: 'monospace' }}
              />
            )}
          </div>
        </div>

        {/* Generated key preview */}
        {generatedKey && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: keyExists ? 'var(--red-light)' : keyValid ? 'var(--emerald-pale)' : 'var(--sand)',
            marginBottom: 16,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ color: 'var(--ink-pale)' }}>Key:</span>
            <code style={{ fontFamily: 'monospace', color: 'var(--ink)', fontWeight: 600 }}>{generatedKey}</code>
            {keyExists
              ? <span style={{ color: 'var(--red)', marginLeft: 'auto' }}>✕ already exists</span>
              : keyValid
                ? <span style={{ color: 'var(--emerald)', marginLeft: 'auto' }}>✓ unique</span>
                : null}
          </div>
        )}

        {/* Labels */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Label (English)</label>
          <input
            className="f-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Export Reports"
            required
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Label (Urdu)</label>
          <RTLInput value={labelUr} onChange={(e) => setLabelUr(e.target.value)} placeholder="اردو نام" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Description (optional)</label>
          <textarea
            className="f-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', resize: 'none' }}
          />
        </div>

        {/* Assign to roles */}
        {roles.length > 0 && (
          <div style={{ borderTop: '1px solid var(--sand-mid)', paddingTop: 16, marginBottom: 20 }}>
            <label style={{ ...lbl, marginBottom: 10 }}>Assign to roles immediately (optional)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {roles.map((role) => (
                <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-mid)' }}>
                  <input
                    type="checkbox"
                    checked={assignRoles.has(role.id)}
                    onChange={() => toggleRole(role.id)}
                    style={{ width: 15, height: 15, accentColor: 'var(--emerald)' }}
                  />
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: role.color ?? 'var(--sand-deep)', flexShrink: 0 }} />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" onClick={handleClose} type="button">Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !keyValid || keyExists || !label.trim()}
          >
            {busy ? 'Creating…' : 'Add permission'}
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
