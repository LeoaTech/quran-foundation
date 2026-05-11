import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import { createAssessment } from '../../../api/assessments';

const TYPES = [
  { value: 'written',    label: 'Written test'  },
  { value: 'oral',       label: 'Oral evaluation' },
  { value: 'topic_test', label: 'Topic test'    },
];

const EMPTY = {
  title: '', title_ur: '', type: 'written',
  assessment_date: new Date().toISOString().slice(0, 10),
  max_score: '', instructions_ur: '',
};

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 16 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

export default function CreateAssessmentModal({ open, classId, onClose, onCreated }) {
  const qc    = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const isOral = form.type === 'oral';

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        title:           form.title,
        title_ur:        form.title_ur        || undefined,
        type:            form.type,
        assessment_date: form.assessment_date,
        max_score:       isOral ? undefined : (form.max_score ? Number(form.max_score) : undefined),
        instructions_ur: form.instructions_ur || undefined,
      };
      const result = await createAssessment(classId, payload);
      await qc.invalidateQueries({ queryKey: ['class-assessments', classId] });
      toast.success('Assessment created.');
      onCreated?.(result?.id ?? result?.data?.id);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to create assessment.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    onClose();
  }

  return (
    <Modal open={open} title="Create assessment" size="md" onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Title (English)">
          <input className="f-input" value={form.title} onChange={set('title')} placeholder="e.g. Monthly Tajweed Test" required />
        </Field>

        <Field label="Title (Urdu) — اردو عنوان">
          <RTLInput placeholder="ماہانہ تجوید ٹیسٹ" value={form.title_ur} onChange={set('title_ur')} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Type">
            <select className="f-select" value={form.type} onChange={set('type')} required>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Date">
            <input className="f-input" type="date" value={form.assessment_date} onChange={set('assessment_date')} required />
          </Field>
        </div>

        {!isOral && (
          <Field label="Max score">
            <input className="f-input" type="number" min="1" max="1000" value={form.max_score} onChange={set('max_score')} placeholder="e.g. 50" required />
          </Field>
        )}

        {isOral && (
          <div style={{ background: 'var(--blue-light)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--blue)', marginBottom: 16 }}>
            Oral evaluation uses grades (Excellent / Good / Average / Fail) instead of a numeric score.
          </div>
        )}

        <Field label="Instructions (Urdu) — ہدایات">
          <RTLInput multiline rows={2} placeholder="تمام سوالات لازمی ہیں" value={form.instructions_ur} onChange={set('instructions_ur')} />
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create assessment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
