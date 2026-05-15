import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import PageHeader from '../../../components/PageHeader';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import { getStaffDetails, updateBaseSalary } from '../../../api/salaries';
import { createUser, removeUserFromCenter } from '../../../api/users';

export default function TeachersList() {
  const { user } = useAuth();
  const centerId = user?.center_id;
  const qc = useQueryClient();
  const toast = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ 
    full_name: '', 
    phone: '', 
    base_salary: '',
    joining_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    bank_name: '',
    account_number: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editId, setEditId] = useState(null);
  const [editSalary, setEditSalary] = useState('');

  const { data: staffData, isLoading, error } = useQuery({
    queryKey: ['staff', centerId],
    queryFn: () => getStaffDetails(centerId),
    enabled: !!centerId,
  });

  const staff = staffData?.data ?? [];

  async function handleAdd(e) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createUser({
        ...form,
        role: 'teacher',
        center_id: centerId,
        base_salary: form.base_salary ? Number(form.base_salary) : 0,
      });
      toast.success('Teacher added successfully');
      setShowAdd(false);
      setForm({ 
        full_name: '', 
        phone: '', 
        base_salary: '',
        joining_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        bank_name: '',
        account_number: ''
      });
      qc.invalidateQueries(['staff', centerId]);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to add teacher');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit(staffUserId) {
    try {
      await updateBaseSalary(centerId, staffUserId, Number(editSalary));
      toast.success('Salary updated');
      setEditId(null);
      qc.invalidateQueries(['staff', centerId]);
    } catch (err) {
      toast.error('Failed to update salary');
    }
  }

  async function handleRemove(staffUserId, name) {
    if (!window.confirm(`Are you sure you want to remove ${name} from this center?`)) return;
    try {
      await removeUserFromCenter(staffUserId, centerId);
      toast.success('Teacher removed from center');
      qc.invalidateQueries(['staff', centerId]);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to remove teacher');
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <PageHeader title="Teachers & Staff" subtitle="Manage teachers and staff salaries" />
        <Button variant="primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add Teacher'}
        </Button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--white)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--emerald)', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, fontFamily: 'var(--font-display)' }}>Add New Teacher</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' }}>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Full Name</label>
                <input required className="f-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Phone</label>
                <input required className="f-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Joining Date</label>
                <input type="date" required className="f-input" value={form.joining_date} onChange={e => setForm({...form, joining_date: e.target.value})} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Base Salary (PKR)</label>
                <input type="number" required min="0" className="f-input" value={form.base_salary} onChange={e => setForm({...form, base_salary: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap', marginTop: 12 }}>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Payment Method</label>
                <select className="f-input" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                  <option value="cash">Cash (Phase 1)</option>
                  <option value="bank">Bank Transfer (Phase 2 - inactive)</option>
                </select>
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Bank Name</label>
                <input className="f-input" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} disabled={form.payment_method === 'cash'} placeholder={form.payment_method === 'cash' ? 'N/A' : 'e.g. HBL'} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Account Number</label>
                <input className="f-input" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} disabled={form.payment_method === 'cash'} placeholder={form.payment_method === 'cash' ? 'N/A' : 'IBAN or account no.'} />
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Teacher & Salary Profile'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          Failed to load staff list.
        </div>
      )}

      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {staff.length === 0 && !isLoading ? (
          <EmptyState icon="◉" title="No staff yet" description="Add teachers to your center to manage their salaries." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Phone', 'Role', 'Base Salary (PKR)', 'Joining Date', 'Payment', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px', borderBottom: '1px solid var(--sand-mid)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.user_id} style={{ borderBottom: '1px solid var(--sand)' }}>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{s.full_name}</span></td>
                    <td style={tdStyle}>{s.phone}</td>
                    <td style={tdStyle}><Badge variant="blue">{s.role}</Badge></td>
                    <td style={tdStyle}>
                      {editId === s.user_id ? (
                        <input type="number" className="f-input" style={{ width: 100, padding: '4px 8px' }} value={editSalary} onChange={e => setEditSalary(e.target.value)} autoFocus />
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>{Number(s.base_salary ?? 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td style={tdStyle}>{s.joining_date ? new Date(s.joining_date).toLocaleDateString() : '—'}</td>
                    <td style={tdStyle}>
                      {s.payment_method === 'bank' ? (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Bank</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Cash</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {editId === s.user_id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleSaveEdit(s.user_id)} style={{ color: 'var(--emerald)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setEditId(s.user_id); setEditSalary(s.base_salary ?? ''); }} style={{ color: 'var(--blue)', background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer' }}>
                            Edit Salary
                          </button>
                          <button onClick={() => handleRemove(s.user_id, s.full_name)} style={{ color: 'var(--red)', background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const tdStyle = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--ink-mid)',
  verticalAlign: 'middle',
};
