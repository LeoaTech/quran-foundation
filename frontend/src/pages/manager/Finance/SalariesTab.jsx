import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { getStaffDetails, recordSalaryPayment, getSalaryPayments } from '../../../api/salaries';
import { getCenters } from '../../../api/centers';
import { useIsMobile } from '../../../hooks/useIsMobile';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString('ur-PK', { maximumFractionDigits: 0 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
}
function currentMonthLabel() {
  return new Date().toLocaleString('en-PK', { month: 'long', year: 'numeric' });
}
function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function isSameMonthAndYear(dateStr, month, year) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (d.getMonth() + 1) === Number(month) && d.getFullYear() === Number(year);
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function getYearsList() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    years.push(y);
  }
  return years;
}

function getPreviousMonthAndYear() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear()
  };
}

const thStyle = {
  textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--ink-pale)', textTransform: 'uppercase',
  letterSpacing: '0.05em', padding: '10px 14px',
  borderBottom: '1px solid var(--sand-mid)', whiteSpace: 'nowrap',
};
const td = (hasBorder = true) => ({
  padding: '11px 14px', fontSize: 13, color: 'var(--ink-mid)',
  borderBottom: hasBorder ? '1px solid var(--sand)' : 'none',
  verticalAlign: 'middle',
});

// ── Record Payment Modal ───────────────────────────────────────────────────────

function RecordPaymentModal({ centerId, staff, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({
    staff_user_id: '',
    amount_paid: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedStaff = staff.find(s => s.user_id === form.staff_user_id);
  // Pre-fill amount with base salary when staff selected
  function onStaffChange(e) {
    const s = staff.find(x => x.user_id === e.target.value);
    setForm(f => ({
      ...f,
      staff_user_id: e.target.value,
      amount_paid: s ? String(Number(s.base_salary)) : f.amount_paid,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.staff_user_id) { setError('Please select a staff member.'); return; }
    if (!form.amount_paid || Number(form.amount_paid) <= 0) { setError('Enter a valid amount.'); return; }

    setBusy(true);
    try {
      await recordSalaryPayment(centerId, {
        staff_user_id: form.staff_user_id,
        amount_paid: Number(form.amount_paid),
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        notes: form.notes || undefined,
      });
      toast.success(`Payment of PKR ${fmt(form.amount_paid)} recorded for ${selectedStaff?.full_name ?? ''}.`);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to record payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-xl)', padding: 28, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', marginBottom: 2 }}>Record Salary Payment</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Log a cash disbursement to a staff member.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-pale)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Staff selector */}
          <div className="f-group" style={{ marginBottom: 14 }}>
            <label className="f-label">Staff member <span style={{ color: 'var(--red)' }}>*</span></label>
            <select required className="f-select" value={form.staff_user_id} onChange={onStaffChange}>
              <option value="">— Select staff —</option>
              {staff.map(s => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name} ({s.role}) — Base: PKR {fmt(s.base_salary)}
                </option>
              ))}
            </select>
          </div>

          {/* Base salary hint */}
          {selectedStaff && (
            <div style={{ background: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span>📋 Base salary: <strong>PKR {fmt(selectedStaff.base_salary)}/mo</strong></span>
              {selectedStaff.payment_method && (
                <span>💳 Preferred: <strong>{selectedStaff.payment_method}</strong></span>
              )}
            </div>
          )}

          {/* Amount + date */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="f-group">
              <label className="f-label">Amount (PKR) <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="number" required min="1" className="f-input"
                placeholder="e.g. 25000" value={form.amount_paid}
                onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
              />
            </div>
            <div className="f-group">
              <label className="f-label">Payment date <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="date" required className="f-input"
                value={form.payment_date}
                onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Method */}
          <div className="f-group" style={{ marginBottom: 14 }}>
            <label className="f-label">Payment method</label>
            <select className="f-select" value={form.payment_method}
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="cash"> Cash</option>
              {/* <option value="bank"> Bank Transfer</option> */}
            </select>
          </div>

          {/* Notes */}
          <div className="f-group" style={{ marginBottom: 20 }}>
            <label className="f-label">Notes (optional)</label>
            <textarea
              className="f-input" rows={2} style={{ resize: 'vertical' }}
              placeholder={`e.g. ${currentMonthLabel()} salary, advance…`}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}
              style={{ background: 'var(--emerald)', borderColor: 'var(--emerald)', minWidth: 160 }}>
              {busy ? 'Recording…' : `Pay PKR ${form.amount_paid ? fmt(form.amount_paid) : '—'}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SalarySheet({ staff, payments, selectedMonth, selectedYear, onPayNow }) {
  const [filter, setFilter] = useState('all'); // all | paid | pending

  // Match staff to their payment using staff_user_id or staff_name
  const sheet = staff.map(s => {
    const payment = payments.find(
      p => isSameMonthAndYear(p.payment_date, selectedMonth, selectedYear) && (p.staff_user_id === s.user_id || p.staff_name === s.full_name)
    );
    return { ...s, payment, status: payment ? 'paid' : 'pending' };
  });

  const filtered = filter === 'all' ? sheet
    : sheet.filter(r => r.status === filter);

  const paidCount = sheet.filter(r => r.status === 'paid').length;
  const pendingCount = sheet.filter(r => r.status === 'pending').length;
  const totalPayable = sheet.reduce((s, r) => s + Number(r.base_salary || 0), 0);
  const totalPaid = sheet
    .filter(r => r.status === 'paid')
    .reduce((s, r) => s + Number(r.payment?.amount_paid || 0), 0);

  const monthObj = MONTHS.find(m => m.value === Number(selectedMonth));
  const currentMonthLabelStr = monthObj ? `${monthObj.label} ${selectedYear}` : `${selectedMonth}/${selectedYear}`;

  return (
    <div>
      {/* Sheet header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
            Salary Sheet — {currentMonthLabelStr}
          </h4>
          <p style={{ fontSize: 12, color: 'var(--ink-pale)' }}>
            {paidCount} paid · {pendingCount} pending · Total payable PKR {fmt(totalPayable)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'paid', 'pending'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
              border: '1.5px solid',
              borderColor: filter === f ? 'var(--emerald)' : 'var(--sand-mid)',
              background: filter === f ? 'var(--emerald-light, #ecfdf5)' : 'var(--white)',
              color: filter === f ? 'var(--emerald)' : 'var(--ink-soft)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{f === 'all' ? 'All' : f === 'paid' ? 'Paid' : ' Pending'}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="✅" title="All clear" description={`No staff in this filter.`} />
      ) : (
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Staff</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Base Salary</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Amount Paid</th>
                <th style={thStyle}>Payment Date</th>
                <th style={thStyle}>Paid By</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.user_id} style={{
                  background: row.status === 'pending' ? 'rgba(251,191,36,0.04)' : 'transparent',
                }}>
                  <td style={td(i < filtered.length - 1)}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.full_name}</span>
                    {row.phone && <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{row.phone}</div>}
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    <Badge variant={row.role === 'teacher' ? 'green' : 'blue'}>{row.role}</Badge>
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    <span style={{ fontWeight: 600 }}>PKR {fmt(row.base_salary)}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-pale)', marginLeft: 3 }}>/mo</span>
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    {row.status === 'paid' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--emerald)' }}>
                        Received
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#d97706' }}>
                        Pending
                      </span>
                    )}
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    {row.status === 'paid'
                      ? <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>PKR {fmt(row.payment?.amount_paid)}</span>
                      : <span style={{ color: 'var(--ink-pale)', fontStyle: 'italic' }}>—</span>
                    }
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {row.status === 'paid' ? fmtDate(row.payment?.payment_date) : '—'}
                    </span>
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {row.status === 'paid' ? (row.payment?.paid_by_name || '—') : '—'}
                    </span>
                  </td>
                  <td style={td(i < filtered.length - 1)}>
                    {row.status === 'pending' && (
                      <Button size="sm" variant="primary"
                        style={{ background: 'var(--emerald)', borderColor: 'var(--emerald)', fontSize: 12, padding: '5px 12px' }}
                        onClick={() => onPayNow(row)}>
                        Pay Now
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Payment History ───────────────────────────────────────────────────────────

function PaymentHistory({ payments }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: 24 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sand-mid)' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
          All Payment Records • {payments.length} total
        </span>
      </div>
      {payments.length === 0 ? (
        <EmptyState icon="⚹" title="No payments yet" description="Record a salary payment to see the full log here." />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Staff</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>Recorded By</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={p.id}>
                <td style={td(i < payments.length - 1)}>
                  <span style={{ fontSize: 13 }}>{fmtDate(p.payment_date)}</span>
                </td>
                <td style={td(i < payments.length - 1)}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.staff_name}</span>
                </td>
                <td style={td(i < payments.length - 1)}>
                  <span style={{ fontWeight: 700, color: 'var(--emerald)', fontSize: 14 }}>PKR {fmt(p.amount_paid)}</span>
                </td>
                <td style={td(i < payments.length - 1)}>
                  <Badge variant={p.payment_method === 'cash' ? 'gold' : 'blue'}>
                    {p.payment_method === 'cash' ? ' Cash' : ' Bank'}
                  </Badge>
                </td>
                <td style={td(i < payments.length - 1)}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.paid_by_name}</span>
                </td>
                <td style={td(i < payments.length - 1)}>
                  <span style={{ fontSize: 12, color: 'var(--ink-pale)', fontStyle: p.notes ? 'normal' : 'italic' }}>
                    {p.notes || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function SalariesTab({ centerId: propCenterId }) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isGlobal = role === 'super_admin' || role === 'finance_manager';
  const isMobile = useIsMobile();

  const defaultCenter = propCenterId || user?.center_id || '';
  const [selectedCenter, setSelectedCenter] = useState(defaultCenter);
  const [showModal, setShowModal] = useState(false);
  const [preselectedStaff, setPreselectedStaff] = useState(null); // for "Pay Now" shortcut

  const getLastMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7); // "YYYY-MM"
  };
  const [monthStr, setMonthStr] = useState(getLastMonthStr());
  const selectedYear = Number(monthStr.slice(0, 4));
  const selectedMonth = Number(monthStr.slice(5, 7));

  const activeCenterId = selectedCenter || defaultCenter;

  const { data: centersData } = useQuery({
    queryKey: ['centers'],
    queryFn: getCenters,
    enabled: isGlobal,
    staleTime: 5 * 60_000,
  });
  const centers = centersData?.data ?? centersData ?? [];

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', activeCenterId],
    queryFn: () => getStaffDetails(activeCenterId),
    enabled: !!activeCenterId,
    staleTime: 30_000,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['salary_payments', activeCenterId, selectedMonth, selectedYear],
    queryFn: () => getSalaryPayments(activeCenterId, { month: selectedMonth, year: selectedYear, per_page: 200 }),
    enabled: !!activeCenterId,
  });

  const allStaff = staffData?.data ?? staffData ?? [];
  const allPayments = paymentsData?.data ?? [];

  const selectedMonthObj = MONTHS.find(m => m.value === Number(selectedMonth));
  const currentMonthLabelStr = selectedMonthObj ? `${selectedMonthObj.label} ${selectedYear}` : `${selectedMonth}/${selectedYear}`;

  // Selected-month summary
  const monthPayments = allPayments.filter(p => isSameMonthAndYear(p.payment_date, selectedMonth, selectedYear));
  const paidThisMonth = monthPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const totalPayable = allStaff.reduce((s, st) => s + Number(st.base_salary || 0), 0);
  const paidStaffIds = new Set(monthPayments.map(p => p.staff_user_id ?? p.staff_name));
  const receivedCount = allStaff.filter(s => paidStaffIds.has(s.user_id) || paidStaffIds.has(s.full_name)).length;
  const pendingCount = allStaff.length - receivedCount;

  function handleSuccess() {
    setShowModal(false);
    setPreselectedStaff(null);
    qc.invalidateQueries({ queryKey: ['salary_payments', activeCenterId] });
  }
  function handlePayNow(staffRow) {
    setPreselectedStaff(staffRow);
    setShowModal(true);
  }

  const isLoading = staffLoading || paymentsLoading;

  // Inject preselected staff into modal by filtering staff list
  const staffForModal = preselectedStaff
    ? [preselectedStaff, ...allStaff.filter(s => s.user_id !== preselectedStaff.user_id)]
    : allStaff;

  return (
    <>
      {showModal && activeCenterId && (
        <RecordPaymentModal
          centerId={activeCenterId}
          staff={staffForModal}
          onClose={() => { setShowModal(false); setPreselectedStaff(null); }}
          onSuccess={handleSuccess}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', marginBottom: 2 }}>Salary Management</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Track cash disbursements and generate salary sheets per center.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {isGlobal && (
            <select className="f-select" style={{ width: 200 }}
              value={selectedCenter}
              onChange={e => setSelectedCenter(e.target.value)}>
              <option value="">— Select center —</option>
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {activeCenterId && (
            <input
              className="f-input"
              type="month"
              value={monthStr}
              onChange={e => setMonthStr(e.target.value)}
              style={{ width: 160 }}
            />
          )}
          <Button variant="primary" disabled={!activeCenterId}
            onClick={() => { setPreselectedStaff(null); setShowModal(true); }}
            style={{ background: 'var(--emerald)', borderColor: 'var(--emerald)' }}>
            + Record Payment
          </Button>
        </div>
      </div>

      {!activeCenterId ? (
        <EmptyState icon="🏢" title="Select a center" description="Choose a center above to view the salary sheet." />
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <>
          {/* ── Summary cards (selected month/year) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-pale)', marginBottom: 5 }}>Total Payable</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>PKR {fmt(totalPayable)}</p>
              <p style={{ fontSize: 10, color: 'var(--ink-pale)', marginTop: 3 }}>{currentMonthLabelStr}</p>
            </div>
            <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-pale)', marginBottom: 5 }}>Paid This Month</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--emerald)', fontFamily: 'var(--font-display)' }}>PKR {fmt(paidThisMonth)}</p>
              <p style={{ fontSize: 10, color: 'var(--ink-pale)', marginTop: 3 }}>{receivedCount} of {allStaff.length} staff</p>
            </div>
            <div style={{ background: pendingCount > 0 ? '#fffbeb' : 'var(--white)', border: `1px solid ${pendingCount > 0 ? '#fcd34d' : 'var(--sand-mid)'}`, borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-pale)', marginBottom: 5 }}>Pending</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: pendingCount > 0 ? '#d97706' : 'var(--ink)', fontFamily: 'var(--font-display)' }}>{pendingCount}</p>
              <p style={{ fontSize: 10, color: 'var(--ink-pale)', marginTop: 3 }}>staff not paid yet</p>
            </div>
            <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-pale)', marginBottom: 5 }}>Total Staff</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{allStaff.length}</p>
              <p style={{ fontSize: 10, color: 'var(--ink-pale)', marginTop: 3 }}>registered members</p>
            </div>
          </div>

          {/* ── Salary Sheet ── */}
          <SalarySheet
            staff={allStaff}
            payments={allPayments}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPayNow={handlePayNow}
          />

          {/* ── Full Payment History ── */}
          {/* <PaymentHistory payments={allPayments} /> */}
        </>
      )}
    </>
  );
}
