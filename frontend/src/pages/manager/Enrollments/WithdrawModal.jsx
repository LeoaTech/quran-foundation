import { useState } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import { updateEnrollment } from '../../../api/enrollments';

export default function WithdrawModal({ open, enrollment, onClose, onSuccess }) {
  const toast = useToast();
  const [withdrawnOn, setWithdrawnOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason]           = useState('');
  const [busy, setBusy]               = useState(false);

  const studentName = enrollment?.full_name ?? enrollment?.student?.full_name ?? 'this student';
  const className   = enrollment?.class_name ?? enrollment?.class?.name ?? 'this class';

  async function handleConfirm() {
    setBusy(true);
    try {
      await updateEnrollment(enrollment.id, {
        status:       'withdrawn',
        withdrawn_on: withdrawnOn,
        ...(reason ? { notes_ur: reason } : {}),
      });
      toast.success(`${studentName} withdrawn from ${className}.`);
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to withdraw student.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setWithdrawnOn(new Date().toISOString().slice(0, 10));
    setReason('');
    onClose();
  }

  return (
    <Modal open={open} title="Withdraw student" size="sm" onClose={handleClose}>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
        Are you sure you want to withdraw <strong style={{ color: 'var(--ink)' }}>{studentName}</strong> from{' '}
        <strong style={{ color: 'var(--ink)' }}>{className}</strong>?
      </p>

      <div className="f-group" style={{ marginBottom: 16 }}>
        <label className="f-label">Withdrawal date</label>
        <input
          className="f-input"
          type="date"
          value={withdrawnOn}
          onChange={(e) => setWithdrawnOn(e.target.value)}
          required
        />
      </div>

      <div className="f-group" style={{ marginBottom: 20 }}>
        <label className="f-label">Reason (optional) — اردو</label>
        <RTLInput
          multiline
          rows={2}
          placeholder="وجہ درج کریں…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          style={{ background: 'var(--red)', boxShadow: 'none' }}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? 'Withdrawing…' : 'Withdraw student'}
        </Button>
      </div>
    </Modal>
  );
}
