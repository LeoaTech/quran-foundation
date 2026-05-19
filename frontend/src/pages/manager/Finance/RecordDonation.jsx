import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { recordDonation } from '../../../api/donations';
import { getStudents, getUsers } from '../../../api/users';

const DONOR_TYPES = [
  { id: 'student', label: 'Student', icon: '🎓' },
  { id: 'teacher', label: 'Teacher', icon: '👤' },
  { id: 'visitor', label: 'Visitor', icon: '🌙' },
];

export default function RecordDonation() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [donorType, setDonorType] = useState('visitor');
  const [donorUserId, setDonorUserId] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('General (Sadaqah)');
  const [notes, setNotes] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Fetch registered users when donor type is student or teacher
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', donorType],
    queryFn: () => {
      if (donorType === 'student') return getStudents({ perPage: 200 });
      if (donorType === 'teacher') return getUsers({ role: 'teacher', per_page: 200 });
      return null;
    },
    enabled: donorType === 'student' || donorType === 'teacher',
  });

  const registeredUsers = usersData?.data ?? [];

  const handleUserSelect = (userId) => {
    setDonorUserId(userId);
    const selected = registeredUsers.find(u => u.id === userId);
    if (selected) {
      setDonorName(selected.full_name);
      setDonorPhone(selected.phone || '');
    } else {
      setDonorName('');
      setDonorPhone('');
    }
  };

  const handleTypeChange = (type) => {
    setDonorType(type);
    setDonorUserId('');
    setDonorName('');
    setDonorPhone('');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    if (!isAnonymous && !donorName.trim()) {
      setErrorMsg('Please enter a donor name or mark the donation as anonymous.');
      return;
    }

    setIsSubmitting(true);

    try {
      await recordDonation({
        donor_type: donorType,
        donor_user_id: donorUserId || undefined,
        donor_name: isAnonymous ? 'Anonymous' : donorName,
        donor_phone: donorPhone || undefined,
        amount: Number(amount),
        date_received: dateReceived,
        purpose,
        notes: notes || undefined,
        is_anonymous: isAnonymous,
      });

      toast.success('Donation recorded successfully!');
      qc.invalidateQueries({ queryKey: ['donations'] });
      navigate(`${role === 'super_admin' ? '/admin' : role === 'finance_manager' ? '/finance' : '/manager'}/donations`);
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to record donation.');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Record New Donation
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Log a donation received from any donor for the organization.
        </p>
      </div>

      {errorMsg && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginBottom: 24, border: '1px solid var(--red)' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', padding: 32, boxShadow: 'var(--shadow-sm)' }}>

        <div style={{ marginBottom: 24 }}>
          <label className="f-label">Donor Type <span style={{ color: 'var(--red)' }}>*</span></label>
          <div style={{ display: 'flex', gap: 12 }}>
            {DONOR_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTypeChange(t.id)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                  background: donorType === t.id ? 'var(--sand)' : 'none',
                  border: donorType === t.id ? '1.5px solid var(--emerald)' : '1px solid var(--sand-deep)',
                  color: donorType === t.id ? 'var(--emerald)' : 'var(--ink-mid)',
                  fontWeight: donorType === t.id ? 600 : 400,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ fontSize: 14 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
          {(donorType === 'student' || donorType === 'teacher') ? (
            <div className="field">
              <label>Select {donorType === 'student' ? 'Student' : 'Teacher'} <span style={{ color: 'var(--red)' }}>*</span></label>
              <select
                value={donorUserId}
                onChange={e => handleUserSelect(e.target.value)}
                disabled={usersLoading}
                required={!isAnonymous}
              >
                <option value="">-- Select {donorType} --</option>
                {registeredUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.full_name_ur ? `(${u.full_name_ur})` : ''} {u.phone ? ` - ${u.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>Donor Name {!isAnonymous && <span style={{ color: 'var(--red)' }}>*</span>}</label>
              <input
                type="text"
                placeholder={isAnonymous ? 'Anonymous' : "Enter donor name"}
                value={isAnonymous ? '' : donorName}
                onChange={e => setDonorName(e.target.value)}
                required={!isAnonymous}
                disabled={isAnonymous}
                style={isAnonymous ? { background: 'var(--sand-light)', cursor: 'not-allowed' } : {}}
              />
            </div>
          )}

          <div className="field">
            <label>Phone (Optional)</label>
            <input
              type="tel"
              placeholder="Contact"
              value={donorPhone}
              onChange={e => setDonorPhone(e.target.value)}
              readOnly={!!donorUserId}
              style={donorUserId ? { background: 'var(--sand-light)', cursor: 'not-allowed' } : {}}
            />
          </div>
        </div>

        {/* Anonymous Donation Checkbox */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="is_anonymous"
            checked={isAnonymous}
            onChange={e => setIsAnonymous(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--emerald)' }}
          />
          <label htmlFor="is_anonymous" style={{ fontSize: 14, color: 'var(--ink-mid)', cursor: 'pointer', userSelect: 'none' }}>
            Donor wishes to remain <strong>anonymous</strong> — their name will be hidden in donation records
          </label>
        </div>

        {(donorType === 'student' || donorType === 'teacher') && donorUserId && !isAnonymous && (
          <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--sand-mid)', fontSize: 13, color: 'var(--ink-mid)' }}>
            Selected: <strong>{donorName}</strong> {donorPhone && `(${donorPhone})`}
          </div>
        )}

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
          <div className="field">
            <label>Amount (PKR) <span style={{ color: 'var(--red)' }}>*</span></label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ background: 'var(--sand)', padding: '10px 14px', border: '1px solid var(--sand-deep)', borderRight: 'none', borderTopLeftRadius: 'var(--radius-sm)', borderBottomLeftRadius: 'var(--radius-sm)', color: 'var(--ink-soft)', fontWeight: 600 }}>PKR</div>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Date Received <span style={{ color: 'var(--red)' }}>*</span></label>
            <input
              type="date"
              value={dateReceived}
              onChange={e => setDateReceived(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 24 }}>
          <label>Purpose / Category <span style={{ color: 'var(--red)' }}>*</span></label>
          <select value={purpose} onChange={e => setPurpose(e.target.value)} required>
            <option value="General (Sadaqah)">General (Sadaqah)</option>
            <option value="Zakat">Zakat</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="field" style={{ marginBottom: 32 }}>
          <label>Notes</label>
          <textarea
            rows={3}
            placeholder="Optional remarks..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>


        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button type="button" variant="outline" onClick={() => navigate(`${role === 'super_admin' ? '/admin' : role === 'finance_manager' ? '/finance' : '/manager'}/donations`)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} style={{ background: 'var(--emerald)', borderColor: 'var(--emerald)' }}>
            {isSubmitting ? 'Recording...' : 'Record Donation'}
          </Button>
        </div>
      </form>
    </>
  );
}
