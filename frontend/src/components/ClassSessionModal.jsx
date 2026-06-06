import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from './Modal';
import Button from './Button';
import { useToast } from '../hooks/useToast';
import { upsertClassSessionPlan } from '../api/classes';
import { formatTimeShort } from '../utils/classSessions';

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

export default function ClassSessionModal({
  open,
  onClose,
  classId,
  session,
  topics = [],
  enrolledCount = 0,
  onMarkAttendance,
  onViewAttendance,
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [topicId, setTopicId] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicTitleUr, setTopicTitleUr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    setTopicId(session.plan_topic_id ?? '');
    setTopicTitle(session.display_topic_title ?? session.plan_topic_title ?? '');
    setTopicTitleUr(session.plan_topic_title_ur ?? '');
  }, [open, session]);

  if (!session) return null;

  const present = session.cnt_present ?? 0;
  const total = session.cnt_total ?? 0;
  const hasAttendance = total > 0;
  const attendanceLabel = hasAttendance
    ? `${present}/${total} Present`
    : `—/${enrolledCount || '—'}`;

  const subtitle = [
    session.day_of_week,
    session.date
      ? new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      : '',
    session.start_time
      ? `${formatTimeShort(session.start_time)}${session.end_time ? ` – ${formatTimeShort(session.end_time)}` : ''}`
      : '',
  ].filter(Boolean).join(' · ');

  async function handleSaveTopic(e) {
    e.preventDefault();
    if (!topicId && !topicTitle.trim()) {
      toast.error('Select a syllabus topic or enter a topic name.');
      return;
    }
    setSaving(true);
    try {
      await upsertClassSessionPlan(classId, {
        session_date: session.date,
        schedule_id: isUuid(session.schedule_id) ? session.schedule_id : null,
        topic_id: topicId || null,
        topic_title: topicTitle.trim() || null,
        topic_title_ur: topicTitleUr.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ['class-session-plans', classId] });
      toast.success('Topic saved for this class.');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save topic.');
    } finally {
      setSaving(false);
    }
  }

  function handleTopicSelect(e) {
    const id = e.target.value;
    setTopicId(id);
    const topic = topics.find((t) => t.id === id);
    if (topic) {
      setTopicTitle(topic.title ?? '');
      setTopicTitleUr(topic.title_ur ?? '');
    } else {
      // Clear values when switching back to Custom topic
      setTopicTitle('');
      setTopicTitleUr('');
    }
  }

  return (
    <Modal open={open} title="Class Session" size="md" onClose={onClose}>
      <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: -8, marginBottom: 16 }}>{subtitle}</div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px', background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginBottom: 2 }}>Attendance</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: hasAttendance ? 'var(--emerald)' : 'var(--ink-soft)' }}>
            {attendanceLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasAttendance ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { onViewAttendance?.(session); onClose(); }}>
                View Sheet
              </Button>{canEdit && (
                <Button size="sm" variant="primary" onClick={() => { onMarkAttendance?.(session); onClose(); }}>
                  Edit Attendance
                </Button>
              )}</>
          ) :
            (<Button size="sm" variant="primary" onClick={() => { onMarkAttendance?.(session); onClose(); }}>
              Mark Attendance
            </Button>
            )}
        </div>
      </div>

      <form onSubmit={handleSaveTopic}>
        <div className="f-group" style={{ marginBottom: 14 }}>
          <label className="f-label">Topic from syllabus</label>
          <select className="f-select" value={topicId} onChange={handleTopicSelect}>
            <option value="">— Custom topic —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}{t.title_ur ? ` — ${t.title_ur}` : ''}</option>
            ))}
          </select>
        </div>

        <div className="f-group" style={{ marginBottom: 14 }}>
          <label className="f-label">Topic name</label>
          <input
            className="f-input"
            value={topicTitle}
            onChange={(e) => { setTopicTitle(e.target.value); setTopicId(''); }}
            placeholder="What will be / was taught in this class…"
          />
        </div>

        <div className="f-group" style={{ marginBottom: 20 }}>
          <label className="f-label">Topic name (Urdu)</label>
          <input
            className="f-input"
            dir="rtl"
            value={topicTitleUr}
            onChange={(e) => setTopicTitleUr(e.target.value)}
            placeholder="موضوع…"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Topic'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
