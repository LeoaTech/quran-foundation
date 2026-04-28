import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCenters, createCenter, updateCenter } from '../../api/centers';

function CenterFormModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(
    initial ?? { name: '', name_ur: '', name_ar: '', city: '', address: '' },
  );
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
      await onSave(form);
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error?.message ?? 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span className="card-title">{initial ? 'Edit center' : 'New center'}</span>
          <button className="btn btn-outline" style={{ padding: '5px 12px' }} onClick={onClose}>×</button>
        </div>

        {err && <div className="auth-error" style={{ marginBottom: 16 }}>{err}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid cols-2" style={{ marginBottom: 14 }}>
            <div className="f-group">
              <label className="f-label">Name (English)</label>
              <input className="f-input" value={form.name} onChange={set('name')} required placeholder="e.g. Gulshan Center" />
            </div>
            <div className="f-group">
              <label className="f-label">City</label>
              <input className="f-input" value={form.city ?? ''} onChange={set('city')} placeholder="e.g. Karachi" />
            </div>
          </div>
          <div className="form-grid cols-2" style={{ marginBottom: 14 }}>
            <div className="f-group">
              <label className="f-label">Name (Urdu)</label>
              <input className="f-input f-urdu" dir="rtl" value={form.name_ur ?? ''} onChange={set('name_ur')} placeholder="گلشن سینٹر" />
            </div>
            <div className="f-group">
              <label className="f-label">Name (Arabic)</label>
              <input className="f-input f-urdu" dir="rtl" value={form.name_ar ?? ''} onChange={set('name_ar')} placeholder="مركز گلشن" />
            </div>
          </div>
          <div className="f-group" style={{ marginBottom: 20 }}>
            <label className="f-label">Address</label>
            <input className="f-input" value={form.address ?? ''} onChange={set('address')} placeholder="Street address" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle = {
  background: 'var(--white)', borderRadius: 'var(--radius-lg)',
  padding: 28, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-lg)',
};

export default function Centers() {
  const qc = useQueryClient();
  const [modalData, setModalData] = useState(null);
  const [showModal, setShowModal]  = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['centers'],
    queryFn:  () => listCenters(),
  });

  const createMut = useMutation({
    mutationFn: createCenter,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['centers'] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }) => updateCenter(id, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['centers'] }),
  });

  function openCreate() { setModalData(null); setShowModal(true); }
  function openEdit(center) { setModalData(center); setShowModal(true); }

  async function handleSave(form) {
    if (modalData) {
      await updateMut.mutateAsync({ id: modalData.id, ...form });
    } else {
      await createMut.mutateAsync(form);
    }
  }

  const centers = data?.centers ?? data ?? [];

  return (
    <>
      {showModal && (
        <CenterFormModal
          initial={modalData}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      <div className="page-header">
        <h2>Centers</h2>
        <p>All Quran Foundation learning centers</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openCreate}>+ New center</button>
      </div>

      {isLoading && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Loading centers…</div>}
      {error    && <div className="auth-error">Failed to load centers.</div>}

      {!isLoading && !error && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Urdu name</th>
                  <th>City</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {centers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-pale)', padding: 28 }}>
                      No centers yet. Create the first one.
                    </td>
                  </tr>
                )}
                {centers.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td dir="rtl" style={{ fontFamily: "'Amiri', serif", fontSize: 14 }}>{c.name_ur ?? '—'}</td>
                    <td>{c.city ?? '—'}</td>
                    <td>
                      <span className={`chip ${c.is_active ? 'chip-green' : 'chip-sand'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="card-action" onClick={() => openEdit(c)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
