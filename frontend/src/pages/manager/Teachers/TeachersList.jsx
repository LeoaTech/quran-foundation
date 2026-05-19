import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import PageHeader from '../../../components/PageHeader';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import { getStaffDetails } from '../../../api/salaries';
import { createUser, removeUserFromCenter, updateStaffProfile } from '../../../api/users';
import { getCenters } from '../../../api/centers';

export default function TeachersList() {
  const { user, role } = useAuth();
  const isGlobal = role === 'super_admin' || role === 'finance_manager';
  const centerId = user?.center_id;

  const [selectedCenter, setSelectedCenter] = useState(centerId || 'all');
  const qc = useQueryClient();
  const toast = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    role: 'teacher',
    base_salary: '',
    joining_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    bank_name: '',
    account_number: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editCenterId, setEditCenterId] = useState(null);

  const { data: centersData } = useQuery({
    queryKey: ['centers'],
    queryFn: getCenters,
    enabled: isGlobal,
  });
  const centers = centersData?.data ?? [];

  const { data: staffData, isLoading, error } = useQuery({
    queryKey: ['staff', selectedCenter],
    queryFn: () => getStaffDetails(selectedCenter),
    enabled: !!selectedCenter,
  });

  const staff = staffData?.data ?? [];

  async function handleAdd(e) {
    e.preventDefault();
    const targetCenter = selectedCenter === 'all' ? form.center_id : selectedCenter;
    if (!targetCenter) {
      toast.error('Please select a center first');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editId) {
        await updateStaffProfile(editId, editCenterId, {
          ...form,
          role: role === 'super_admin' ? form.role : 'teacher',
          center_id: targetCenter,
          base_salary: form.base_salary ? Number(form.base_salary) : 0,
        });
        toast.success('Staff profile updated successfully');
      } else {
        await createUser({
          ...form,
          role: role === 'super_admin' ? form.role : 'teacher',
          center_id: targetCenter,
          base_salary: form.base_salary ? Number(form.base_salary) : 0,
        });
        toast.success('Teacher added successfully');
      }

      setShowAdd(false);
      setEditId(null);
      setEditCenterId(null);
      setForm({
        full_name: '',
        phone: '',
        role: 'teacher',
        center_id: '',
        base_salary: '',
        joining_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        bank_name: '',
        account_number: ''
      });
      qc.invalidateQueries(['staff', selectedCenter]);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to add teacher');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditClick(s) {
    setEditId(s.user_id);
    setEditCenterId(s.center_id);
    setForm({
      full_name: s.full_name || '',
      phone: s.phone || '',
      role: s.role || 'teacher',
      center_id: s.center_id || '',
      base_salary: s.base_salary ?? '',
      joining_date: s.joining_date ? new Date(s.joining_date).toISOString().split('T')[0] : '',
      payment_method: s.payment_method || 'cash',
      bank_name: s.bank_name || '',
      account_number: s.account_number || ''
    });
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelAdd() {
    setShowAdd(false);
    setEditId(null);
    setEditCenterId(null);
    setForm({
      full_name: '',
      phone: '',
      role: 'teacher',
      center_id: '',
      base_salary: '',
      joining_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      bank_name: '',
      account_number: ''
    });
  }

  async function handleRemove(staffUserId, staffCenterId, name) {
    if (!window.confirm(`Are you sure you want to remove ${name} from this center?`)) return;
    try {
      await removeUserFromCenter(staffUserId, staffCenterId);
      toast.success('Teacher removed from center');
      qc.invalidateQueries(['staff', selectedCenter]);
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
        <PageHeader title={role === 'super_admin' ? "Staff Management" : "Teachers & Staff"} subtitle={selectedCenter === 'all' ? 'Manage staff across all centers' : 'Manage teachers and staff salaries'} />
        <div style={{ display: 'flex', gap: 12 }}>
          {isGlobal && (
            <select
              className="f-input"
              style={{ width: 200 }}
              value={selectedCenter}
              onChange={e => setSelectedCenter(e.target.value)}
            >
              <option value="all">All Centers</option>
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <Button variant="primary" onClick={showAdd ? handleCancelAdd : () => setShowAdd(true)}>
            {showAdd ? 'Cancel' : (role === 'super_admin' ? '+ Add Staff' : '+ Add Teacher')}
          </Button>
        </div>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--white)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--emerald)', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, fontFamily: 'var(--font-display)' }}>
            {editId ? 'Edit Staff Profile' : (role === 'super_admin' ? 'Add New Staff Member' : 'Add New Teacher')}
          </h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedCenter === 'all' && (
              <div className="f-group" style={{ marginBottom: 8 }}>
                <label className="f-label">Select Center <span style={{ color: 'var(--red)' }}>*</span></label>
                <select
                  required
                  className="f-input"
                  value={form.center_id || ''}
                  onChange={e => setForm({ ...form, center_id: e.target.value })}
                >
                  <option value="">-- Choose Center --</option>
                  {centers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' }}>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Full Name</label>
                <input required className="f-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Phone</label>
                <input required className="f-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Joining Date</label>
                <input type="date" required className="f-input" value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Base Salary (PKR)</label>
                <input type="number" required min="0" className="f-input" value={form.base_salary} onChange={e => setForm({ ...form, base_salary: e.target.value })} />
              </div>
              {role === 'super_admin' && (
                <div className="f-group" style={{ flex: '1 1 200px' }}>
                  <label className="f-label">Role</label>
                  <select className="f-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="teacher">Teacher</option>
                    <option value="center_manager">Center Manager</option>
                    <option value="finance_manager">Finance Manager</option>
                    <option value="area_manager">Area Manager</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap', marginTop: 12 }}>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Payment Method</label>
                <select className="f-input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="cash">Cash </option>
                  <option value="bank">Bank Transfer </option>
                </select>
              </div>

              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Bank Name</label>
                <input disabled={form.payment_method !== 'bank'} className="f-input" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder={form.payment_method === 'cash' ? 'N/A' : 'e.g. HBL'} />
              </div>
              <div className="f-group" style={{ flex: '1 1 200px' }}>
                <label className="f-label">Account Number</label>
                <input disabled={form.payment_method !== 'bank'} className="f-input" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder={form.payment_method === 'cash' ? 'N/A' : 'IBAN or account no.'} />
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (role === 'super_admin' ? 'Save Staff & Salary Profile' : 'Save Teacher & Salary Profile')}
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
          <EmptyState icon="◉" title="No staff yet" description={role === 'super_admin' ? "Select a center to add staff members." : "Add teachers to your center to manage their salaries."} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Phone', 'Role', 'Base Salary (PKR)', 'Joining Date', 'Payment', ...(selectedCenter === 'all' ? ['Center'] : []), 'Actions'].map((h) => (
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
                      <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>{Number(s.base_salary ?? 0).toLocaleString()}</span>
                    </td>
                    <td style={tdStyle}>{s.joining_date ? new Date(s.joining_date).toLocaleDateString() : '—'}</td>
                    <td style={tdStyle}>
                      {s.payment_method === 'bank' ? (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Bank</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Cash</span>
                      )}
                    </td>
                    {selectedCenter === 'all' && (
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12 }}>{centers.find(c => c.id === s.center_id)?.name || '—'}</span>
                      </td>
                    )}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}
                          onClick={() => handleEditClick(s)}                                                    >
                          Edit Profile
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          style={{ color: 'var(--red)', border: 'none' }}
                          onClick={() => handleRemove(s.user_id, s.center_id, s.full_name)} >
                          Remove
                        </Button>
                      </div>
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
