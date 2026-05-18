import { useState } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import { useDeleteRole } from '../../../hooks/usePermissions';
import { useToast } from '../../../hooks/useToast';

export default function DeleteRoleModal({ open, role, onClose, onDeleted }) {
  const toast   = useToast();
  const { mutateAsync: deleteRole } = useDeleteRole();

  const [typed, setTyped] = useState('');
  const [busy,  setBusy]  = useState(false);

  const confirmed  = typed === role?.name;
  const userCount  = role?.user_count ?? 0;

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteRole(role.id);
      toast.success(`Role '${role.name}' deleted`);
      setTyped('');
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to delete role');
    } finally {
      setBusy(false);
    }
  }

  if (!role) return null;

  return (
    <Modal open={open} title="Delete role" size="sm" onClose={() => { setTyped(''); onClose(); }}>
      <div style={{ fontSize: 14, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 16 }}>
        {userCount > 0 ? (
          <>
            <p style={{ marginBottom: 8 }}>
              This role is assigned to <strong>{userCount} user{userCount > 1 ? 's' : ''}</strong>.
              Deleting it will remove this role from those users.
            </p>
            <p style={{ fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', marginBottom: 12, color: 'var(--ink)' }}>
              اس رول کو حذف کرنے سے <strong>{userCount}</strong> صارفین متاثر ہوں گے۔
            </p>
          </>
        ) : (
          <p style={{ marginBottom: 12 }}>
            Are you sure you want to delete <strong>{role.name}</strong>? This action cannot be undone.
          </p>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 6 }}>
          Type <code style={{ background: 'var(--sand)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{role.name}</code> to confirm
        </label>
        <input
          className="f-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={role.name}
          autoFocus
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="outline" onClick={() => { setTyped(''); onClose(); }} type="button">Cancel</Button>
        <Button
          variant="primary"
          disabled={!confirmed || busy}
          onClick={handleDelete}
          style={{ background: confirmed ? 'var(--red)' : undefined, boxShadow: confirmed ? '0 2px 8px rgba(192,57,43,0.25)' : undefined }}
        >
          {busy ? 'Deleting…' : 'Delete role'}
        </Button>
      </div>
    </Modal>
  );
}
