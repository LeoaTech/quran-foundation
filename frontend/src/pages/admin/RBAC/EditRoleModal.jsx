import { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useUpdateRole } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';

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
            width: 28, height: 28, borderRadius: '50%', background: c,
            border: value === c ? '3px solid var(--ink)' : '2px solid transparent',
            outline: value === c ? '2px solid var(--white)' : 'none',
            outlineOffset: '-4px',
            cursor: 'pointer', flexShrink: 0,
          }}
        />
      ))}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#hex"
        maxLength={7}
        style={{ width: 70, padding: '4px 8px', border: '1.5px solid var(--sand-deep)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'monospace', color: 'var(--ink)' }}
      />
      {/^#[0-9a-fA-F]{6}$/.test(value) && (
        <div style={{ width: 22, height: 22, borderRadius: 4, background: value, border: '1px solid var(--sand-mid)', flexShrink: 0 }} />
      )}
    </div>
  );
}

export default function EditRoleModal({ open, role, onClose }) {
  const toast = useToast();
  const { mutateAsync: updateRole } = useUpdateRole();

  const [description, setDescription] = useState('');
  const [labelUr,     setLabelUr]     = useState('');
  const [color,       setColor]       = useState('#1a6b52');
  const [busy,        setBusy]        = useState(false);

  useEffect(() => {
    if (role) {
      setDescription(role.description ?? '');
      setLabelUr(role.label_ur ?? '');
      setColor(role.color ?? '#1a6b52');
    }
  }, [role]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateRole({ roleId: role.id, data: { description, label_ur: labelUr, color } });
      toast.success('Role updated');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update role');
    } finally {
      setBusy(false);
    }
  }

  if (!role) return null;

  return (
    <Modal open={open} title={`Edit role — ${role.name}`} size="md" onClose={onClose}>
      {role.is_system && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'var(--sand)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 12, color: 'var(--ink-soft)' }}>
          <span>🔒</span>
          <span>System role — <strong>name</strong> and <strong>is_system</strong> cannot be changed</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Name (read-only) */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Role name</label>
          <input
            className="f-input"
            value={role.name}
            disabled
            style={{ width: '100%', fontFamily: 'monospace', opacity: 0.6, cursor: 'not-allowed' }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            className="f-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', resize: 'none' }}
          />
        </div>

        {/* Urdu label */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Display label — اردو</label>
          <RTLInput value={labelUr} onChange={(e) => setLabelUr(e.target.value)} />
        </div>

        {/* Color */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Badge color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'var(--ink-mid)', marginBottom: 6, letterSpacing: '0.02em',
};
