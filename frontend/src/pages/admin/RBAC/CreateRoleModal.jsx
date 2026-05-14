import { useState } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useCreateRole } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';
import * as api from '../../../api/rbac';

const PRESET_COLORS = [
  '#1a6b52', '#2aaa84', '#1e5fa8', '#5b21b6',
  '#c0392b', '#c8922a', '#b07a1a', '#3a3a34',
];

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: c,
            border: value === c ? '3px solid var(--ink)' : '2px solid transparent',
            outline: value === c ? '2px solid var(--white)' : 'none',
            outlineOffset: '-4px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
      ))}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#hex"
        maxLength={7}
        style={{
          width: 70, padding: '4px 8px',
          border: '1.5px solid var(--sand-deep)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12, fontFamily: 'monospace',
          color: 'var(--ink)',
        }}
      />
      {/^#[0-9a-fA-F]{6}$/.test(value) && (
        <div style={{ width: 22, height: 22, borderRadius: 4, background: value, border: '1px solid var(--sand-mid)', flexShrink: 0 }} />
      )}
    </div>
  );
}

const SNAKE_RE = /^[a-z][a-z0-9_]*$/;

export default function CreateRoleModal({ open, onClose, existingRoles = [], onCreated }) {
  const toast = useToast();
  const { mutateAsync: createRole } = useCreateRole();

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [labelUr,     setLabelUr]     = useState('');
  const [color,       setColor]       = useState('#1a6b52');
  const [copyFrom,    setCopyFrom]    = useState(false);
  const [copyRoleId,  setCopyRoleId]  = useState('');
  const [busy,        setBusy]        = useState(false);

  const nameError = name && !SNAKE_RE.test(name)
    ? 'Only lowercase letters, digits, and underscores. Must start with a letter.'
    : '';

  function reset() {
    setName(''); setDescription(''); setLabelUr('');
    setColor('#1a6b52'); setCopyFrom(false); setCopyRoleId('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (nameError || !name.trim()) return;
    setBusy(true);
    try {
      const newRole = await createRole({ name, description, label_ur: labelUr, color });

      if (copyFrom && copyRoleId) {
        const sourcePerms = await api.getRolePermissions(copyRoleId);
        const ids = sourcePerms.filter((p) => p.is_granted).map((p) => p.id);
        if (ids.length > 0) {
          await api.setRolePermissions(newRole.id, ids);
        }
      }

      toast.success(`Role '${name}' created`);
      handleClose();
      onCreated?.(newRole.id);
    } catch (err) {
      const msg = err.response?.data?.error?.message ?? 'Failed to create role';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="New role" size="md" onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        {/* Role name */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Role name</label>
          <input
            className="f-input"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="e.g. curriculum_lead"
            required
            autoFocus
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
          {nameError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{nameError}</div>}
          <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 3 }}>snake_case only — will be used as the permission key prefix</div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            className="f-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What can this role do?"
            style={{ width: '100%', resize: 'none' }}
          />
        </div>

        {/* Urdu label */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Display label — اردو</label>
          <RTLInput
            value={labelUr}
            onChange={(e) => setLabelUr(e.target.value)}
            placeholder="مثلاً: نصاب کے ذمہ دار"
          />
        </div>

        {/* Color */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Badge color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {/* Copy from */}
        <div style={{ borderTop: '1px solid var(--sand-mid)', paddingTop: 16, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--ink-mid)' }}>
            <input
              type="checkbox"
              checked={copyFrom}
              onChange={(e) => setCopyFrom(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--emerald)' }}
            />
            Copy permissions from an existing role
          </label>
          {copyFrom && (
            <select
              className="f-select"
              value={copyRoleId}
              onChange={(e) => setCopyRoleId(e.target.value)}
              style={{ width: '100%', marginTop: 10 }}
            >
              <option value="">— Select a role to copy from —</option>
              {existingRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.permission_count} permissions)</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" onClick={handleClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy || !!nameError || !name}>
            {busy ? 'Creating…' : 'Create role'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--ink-mid)',
  marginBottom: 6,
  letterSpacing: '0.02em',
};
