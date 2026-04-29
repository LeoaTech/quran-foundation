import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import RTLInput from '../../../components/RTLInput';
import Button from '../../../components/Button';
import { createCenter } from '../../../api/centers';
import { useToast } from '../../../hooks/useToast';

const EMPTY = { name: '', name_ur: '', city: '', address: '', address_ur: '', phone: '' };

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 14 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

export default function AddCenterModal({ open, onClose }) {
  const qc    = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await createCenter(form);
      await qc.invalidateQueries({ queryKey: ['centers'] });
      toast.success('Center created successfully.');
      setForm(EMPTY);
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error?.message ?? 'Failed to create center.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    setErr('');
    onClose();
  }

  return (
    <Modal open={open} title="New center" size="md" onClose={handleClose}>
      {err && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Name (English)">
            <input className="f-input" placeholder="e.g. Gulshan Center" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="City">
            <input className="f-input" placeholder="e.g. Karachi" value={form.city} onChange={set('city')} />
          </Field>
        </div>

        <Field label="Name (Urdu) — اردو نام">
          <RTLInput placeholder="گلشن سینٹر" value={form.name_ur} onChange={set('name_ur')} />
        </Field>

        <Field label="Address">
          <input className="f-input" placeholder="Street address" value={form.address} onChange={set('address')} />
        </Field>

        <Field label="Address (Urdu) — پتہ">
          <RTLInput placeholder="گلشن اقبال، بلاک ۱۰" value={form.address_ur} onChange={set('address_ur')} />
        </Field>

        <Field label="Phone">
          <input className="f-input" type="tel" placeholder="+9221..." value={form.phone} onChange={set('phone')} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create center'}</Button>
        </div>
      </form>
    </Modal>
  );
}
