import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import { createClass } from '../../../api/classes';
import { getCourses, getCourseLevels } from '../../../api/courses';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY = {
  name: '',
  name_ur: '',
  course_id: '',
  course_level_id: '',
  max_capacity: '',
  schedule_days: [],
  start_time: '',
};

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 16 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

export default function AddClassModal({ open, centerId, onClose }) {
  const qc       = useQueryClient();
  const toast    = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn:  getCourses,
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const { data: levels = [] } = useQuery({
    queryKey:  ['course-levels', form.course_id],
    queryFn:   () => getCourseLevels(form.course_id),
    staleTime: 5 * 60_000,
    enabled:   !!form.course_id,
  });

  // Reset level when course changes
  useEffect(() => {
    setForm((f) => ({ ...f, course_level_id: '' }));
  }, [form.course_id]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function toggleDay(day) {
    setForm((f) => ({
      ...f,
      schedule_days: f.schedule_days.includes(day)
        ? f.schedule_days.filter((d) => d !== day)
        : [...f.schedule_days, day],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.schedule_days.length === 0) {
      toast.error('Select at least one schedule day.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        schedule_days: form.schedule_days.join(','),
        max_capacity: Number(form.max_capacity),
        course_level_id: form.course_level_id || undefined,
      };
      const newClass = await createClass(centerId, payload);
      await qc.invalidateQueries({ queryKey: ['classes', centerId] });
      toast.success('Class created.');
      handleClose();
      navigate(`/manager/classes/${newClass.id ?? newClass.data?.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to create class.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    onClose();
  }

  return (
    <Modal open={open} title="New class section" size="md" onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Class name (English)">
          <input className="f-input" value={form.name} onChange={set('name')} placeholder="e.g. Tajweed Class B" required />
        </Field>

        <Field label="Class name (Urdu) — اردو نام">
          <RTLInput placeholder="تجوید کلاس ب" value={form.name_ur} onChange={set('name_ur')} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Course">
            <select className="f-select" value={form.course_id} onChange={set('course_id')} required>
              <option value="">— Select course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Level (optional)">
            <select className="f-select" value={form.course_level_id} onChange={set('course_level_id')} disabled={!form.course_id}>
              <option value="">— No level —</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Max capacity">
            <input className="f-input" type="number" min="1" max="100" value={form.max_capacity} onChange={set('max_capacity')} placeholder="e.g. 18" required />
          </Field>

          <Field label="Start time">
            <input className="f-input" type="time" value={form.start_time} onChange={set('start_time')} required />
          </Field>
        </div>

        <Field label="Schedule days">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DAYS.map((day) => {
              const selected = form.schedule_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: selected ? '1.5px solid var(--emerald)' : '1.5px solid var(--sand-deep)',
                    background: selected ? 'var(--emerald-light)' : 'var(--white)',
                    color: selected ? 'var(--emerald)' : 'var(--ink-soft)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create class'}</Button>
        </div>
      </form>
    </Modal>
  );
}
