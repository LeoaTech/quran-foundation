import { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useUpdatePermission } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';

export default function EditPermissionModal({ open, permission, onClose }) {
  const toast = useToast();
  const { mutateAsync: updatePermission } = useUpdatePermission();

  const [label,       setLabel]       = useState('');
  const [labelUr,     setLabelUr]     = useState('');
  const [description, setDescription] = useState('');
  const [isActive,    setIsActive]    = useState(true);
  const [busy,        setBusy]        = useState(false);

  useEffect(() => {
    if (permission) {
      setLabel(permission.label ?? '');
      setLabelUr(permission.label_ur ?? '');
      setDescription(permission.description ?? '');
      setIsActive(permission.is_active ?? true);
    }
  }, [permission]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updatePermission({
        permissionId: permission.id,
        data: { label, label_ur: labelUr, description, is_active: isActive },
      });
      toast.success('Permission updated');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update permission');
    } finally {
      setBusy(false);
    }
  }

  if (!permission) return null;

  return (
    <Modal open={open} title="Edit permission" size="md" onClose={onClose}>
      {/* Immutability notice */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-start',
        padding: '10px 14px', background: 'var(--sand)',
        borderRadius: 'var(--radius-sm)', marginBottom: 20,
        fontSize: 12, color: 'var(--ink-soft)',
      }}>
        <span style={{ marginTop: 1 }}>ℹ</span>
        <span>The permission key is immutable after creation. Only labels and description may be changed.</span>
      </div>

      {/* Read-only fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          ['Key',    permission.key,    '2fr'],
          ['Module', permission.module, '1fr'],
          ['Action', permission.action, '1fr'],
        ].map(([label_, val]) => (
          <div key={label_}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label_}</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ink-mid)', background: 'var(--sand)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sand-mid)' }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Label (English)</label>
          <input
            className="f-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Label (Urdu)</label>
          <RTLInput value={labelUr} onChange={(e) => setLabelUr(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Description</label>
          <textarea
            className="f-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', resize: 'none' }}
          />
        </div>

        {/* Active toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <label style={{ ...lbl, marginBottom: 0 }}>Status</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--emerald)' }}
            />
            <span style={{ color: isActive ? 'var(--emerald)' : 'var(--ink-pale)' }}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </label>
          {!isActive && (
            <span style={{ fontSize: 11, color: 'var(--amber)' }}>
              Inactive permissions are hidden from role assignment UI
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy || !label.trim()}>
            {busy ? 'Saving…' : 'Save changes'}
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
