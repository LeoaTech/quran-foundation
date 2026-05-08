import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import { createCourse } from '../../../api/courses';

const EMPTY = { name: '', name_ur: '', name_ar: '', type: 'tajweed', description_ur: '' };

const COURSE_TYPES = [
  { value: 'hifz',    label: 'Hifz'    },
  { value: 'nazra',   label: 'Nazra'   },
  { value: 'tajweed', label: 'Tajweed' },
  { value: 'arabic',  label: 'Arabic'  },
];

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 16 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

export default function AddCourseModal({ open, onClose }) {
  const qc    = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await createCourse(form);
      await qc.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course created.');
      setForm(EMPTY);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to create course.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    onClose();
  }

  return (
    <Modal open={open} title="New course" onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Course name (English)">
          <input
            className="f-input"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Tajweed"
            required
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Name (Urdu) — اردو نام">
            <RTLInput
              placeholder="تجوید"
              value={form.name_ur}
              onChange={set('name_ur')}
            />
          </Field>
          <Field label="Name (Arabic) — الاسم بالعربية">
            <RTLInput
              placeholder="تجويد"
              value={form.name_ar}
              onChange={set('name_ar')}
            />
          </Field>
        </div>

        <Field label="Course type">
          <select className="f-select" value={form.type} onChange={set('type')} required>
            {COURSE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Description (Urdu) — تفصیل">
          <RTLInput
            multiline
            rows={3}
            placeholder="قرآن کریم کی تلاوت کے اصول"
            value={form.description_ur}
            onChange={set('description_ur')}
          />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create course'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
