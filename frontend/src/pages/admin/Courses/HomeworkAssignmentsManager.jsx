import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import { useToast } from '../../../hooks/useToast';
import { getHomeworkContent } from '../../../api/courses';
import {
  getHomeworkSchedule,
  saveHomeworkSchedule,
  updateHomeworkAssignment,
  getAssignmentContent,
  linkAssignmentContent,
} from '../../../api/homework';

// ── Style helpers ─────────────────────────────────────────────────────────────
const card = {
  background: 'var(--white)',
  border: '1.5px solid var(--sand-mid)',
  borderRadius: 'var(--radius-md)',
  padding: '20px 24px',
  marginBottom: 16,
};

const infoBox = (color) => ({
  background: `${color}18`,
  border: `1px solid ${color}44`,
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  color,
  marginBottom: 20,
  lineHeight: 1.5,
});

function Field({ label, children, hint }) {
  return (
    <div className="f-group" style={{ marginBottom: 14 }}>
      <label className="f-label">{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

// ── Content Picker Modal ───────────────────────────────────────────────────────
function AssignContentModal({ courseId, assignment, onClose, onSaved }) {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: allContent = [], isLoading: loadingAll } = useQuery({
    queryKey: ['classworkContent', courseId],
    queryFn: () => getHomeworkContent(courseId),
  });

  const { data: linkedData, isLoading: loadingLinked } = useQuery({
    queryKey: ['homework-assignment-content', courseId, assignment.id],
    queryFn: () => getAssignmentContent(courseId, assignment.id),
  });

  const linkedContent = linkedData?.data ?? linkedData ?? [];
  const [selectedIds, setSelectedIds] = useState(null);

  useEffect(() => {
    if (Array.isArray(linkedContent) && selectedIds === null) {
      setSelectedIds(linkedContent.map((c) => c.id));
    }
  }, [linkedContent, selectedIds]);

  const activeSelected = selectedIds ?? [];

  const handleToggle = (id) => {
    if (activeSelected.includes(id)) {
      setSelectedIds(activeSelected.filter((item) => item !== id));
    } else {
      setSelectedIds([...activeSelected, id]);
    }
  };

  const saveMut = useMutation({
    mutationFn: () => linkAssignmentContent(courseId, assignment.id, activeSelected),
    onSuccess: () => {
      toast.success('Assigned content updated!');
      qc.invalidateQueries(['homework-schedule', courseId]);
      qc.invalidateQueries(['homework-assignment-content', courseId, assignment.id]);
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to save assigned content.'),
  });

  const isLoading = loadingAll || loadingLinked || selectedIds === null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 580,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border, #e5e7eb)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--surface-0, #fafafa)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              🔗 Assign Content to {assignment.title}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--ink-pale)' }}>
              Select verses/phrases from course content repository to link to this assignment slot.
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-soft)' }}
          >×</button>
        </div>

        {/* Content list */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner size={24} />
            </div>
          ) : allContent.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-pale)', padding: '24px 0', fontSize: 13 }}>
              No classwork content available for this course yet. Add content in the "Content" tab first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allContent.map((item) => {
                const isChecked = activeSelected.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 8, border: '1px solid',
                      borderColor: isChecked ? 'var(--emerald, #1a9b6c)' : 'var(--border, #e5e7eb)',
                      background: isChecked ? '#f0fdf4' : '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => { }}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--font-arabic, serif)', fontSize: 18,
                        direction: 'rtl', textAlign: 'right', color: 'var(--ink)',
                      }}>
                        {item.arabic_text}
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {item.surah_number && (
                          <span>Surah {item.surah_number}{item.ayah_number ? `:${item.ayah_number}` : ''}</span>
                        )}
                        {item.total_marks > 0 && (
                          <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>📐 {item.total_marks} marks</span>
                        )}
                        <span>({item.words?.length ?? 0} words)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border, #e5e7eb)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--surface-0, #fafafa)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            {activeSelected.length} content item{activeSelected.length !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => saveMut.mutate()} isLoading={saveMut.isPending}>
              Save Content Links
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', gapDays: 1, hint: '1 day' },
  { value: 'after_2_days', label: 'After 2 Days', gapDays: 2, hint: '2 days' },
  { value: 'weekly', label: 'Weekly', gapDays: 7, hint: '7 days (1 week)' },
  { value: 'biweekly', label: 'Bi-weekly', gapDays: 14, hint: '14 days (2 weeks)' },
  { value: 'monthly', label: 'After month', gapDays: 30, hint: '30 days (~1 month)' },
];

function getFrequencyLabel(key) {
  const found = FREQUENCY_OPTIONS.find((f) => f.value === key);
  return found ? found.label : key;
}

function calculateTotalAssignments(durationMonths, frequencyKey) {
  const months = Number(durationMonths) || 4;
  const totalDays = months * 30;
  const freqObj = FREQUENCY_OPTIONS.find((f) => f.value === frequencyKey);
  const gapDays = freqObj ? freqObj.gapDays : 7;
  return Math.max(1, Math.round(totalDays / gapDays));
}

// ── Schedule Setup Form ───────────────────────────────────────────────────────
function ScheduleForm({ courseId, course, existing, onSaved, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();

  const durationMonths = course?.duration_months || 4;
  const initialFreq = existing?.schedule?.frequency ?? 'weekly';
  const initialTotal = existing?.schedule?.total_assignments ?? calculateTotalAssignments(durationMonths, initialFreq);

  const [form, setForm] = useState({
    frequency: initialFreq,
    total_assignments: initialTotal,
    first_due_date: null,
    instructions: existing?.schedule?.instructions ?? '',
  });

  const mut = useMutation({
    mutationFn: () => saveHomeworkSchedule(courseId, form),
    onSuccess: (data) => {
      toast.success('Homework schedule saved and assignments generated!');
      qc.invalidateQueries(['homework-schedule', courseId]);
      onSaved?.();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to save schedule.'),
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleFrequencyChange = (newFreq) => {
    const autoCount = calculateTotalAssignments(durationMonths, newFreq);
    setForm((f) => ({
      ...f,
      frequency: newFreq,
      total_assignments: autoCount,
    }));
  };



  const currentOpt = FREQUENCY_OPTIONS.find((f) => f.value === form.frequency);

  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
        📅 Homework Schedule Setup
      </h3>
      <div style={infoBox('#2563eb')}>
        ℹ️ This schedule applies to <strong>all centers</strong> teaching this course. Assignments will
        automatically appear to enrolled students on each due date.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Frequency" hint={`One assignment every ${currentOpt?.hint ?? 'interval'}`}>
          <select
            className="f-select"
            value={form.frequency}
            onChange={(e) => handleFrequencyChange(e.target.value)}
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Total Assignments"
          hint={`Auto-calculated from course duration (${durationMonths} mo / ~${durationMonths * 30} days ÷ ${currentOpt?.hint ?? 'interval'})`}
        >
          <input
            type="number"
            className="f-input"
            min={1}
            max={500}
            value={form.total_assignments}
            onChange={(e) => set('total_assignments', Number(e.target.value))}
          />
        </Field>

        <Field label="General Instructions (optional)">
          <textarea
            className="f-input"
            rows={3}
            style={{ resize: 'vertical' }}
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            placeholder="e.g. Read the assigned verses 10 times and practice the rules…"
          />
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          onClick={onClose}
          style={{
            padding: '7px 18px', fontSize: 13, fontWeight: 500,
            border: '1px solid var(--border-strong)', borderRadius: 8,
            background: '#fff', cursor: 'pointer',
          }}
        >Cancel</button>
        <Button
          variant="primary"
          onClick={() => mut.mutate()}
          isLoading={mut.isPending}
        >
          {existing ? '↻ Update & Regenerate' : '✦ Create Schedule'}
        </Button>
      </div>
    </div>
  );
}

import HomeworkGridModal from '../../teacher/Classes/HomeworkGridModal';

// ── Assignment Row (inline edit & content linking) ───────────────────────────
function AssignmentRow({ assignment, courseId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showGridModal, setShowGridModal] = useState(false);
  const [form, setForm] = useState({
    title: assignment.title,
    title_ur: assignment.title_ur ?? '',
    instructions: assignment.instructions ?? '',
    is_published: assignment.is_published,
  });

  const mut = useMutation({
    mutationFn: () => updateHomeworkAssignment(courseId, assignment.id, form),
    onSuccess: () => {
      toast.success('Assignment updated.');
      qc.invalidateQueries(['homework-schedule', courseId]);
      setEditing(false);
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to update.'),
  });

  const isVisible = assignment.due_date ? new Date(assignment.due_date + 'T00:00:00') <= new Date() : false;
  const linkedCount = assignment.linked_content_count ?? 0;
  const totalMarks = assignment.total_marks ?? 0;

  return (
    <div style={{
      border: '1px solid var(--sand-mid)',
      borderRadius: 8,
      background: 'var(--white)',
      overflow: 'hidden',
    }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'var(--emerald-light)', color: 'var(--emerald)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>
          {assignment.assignment_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
            {assignment.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 4, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>📅 Due: {assignment.due_date ? new Date(assignment.due_date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set per class cohort'}</span>
            {linkedCount > 0 ? (
              <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>📖 {linkedCount} content item{linkedCount !== 1 ? 's' : ''}</span>
            ) : (
              <span style={{ color: 'var(--ink-pale)' }}>📖 No content linked</span>
            )}
            {totalMarks > 0 && (
              <span style={{ color: 'var(--emerald)', fontWeight: 700, background: '#d1fae5', padding: '1px 6px', borderRadius: 10 }}>📐 {totalMarks} total marks</span>
            )}
            {assignment.due_date && (isVisible
              ? <span style={{ color: 'var(--emerald)' }}>✅ Visible to students</span>
              : <span style={{ color: 'var(--ink-pale)' }}>🔒 Not yet visible</span>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <Badge variant={assignment.is_published ? 'green' : 'sand'}>
            {assignment.is_published ? 'Published' : 'Draft'}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setShowAssignModal(true)}>
            🔗 Assign Content
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowGridModal(true)}>
            📊 Preview Grid Sheet
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
        </div>
      </div>


      {/* Inline edit form */}
      {editing && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--sand-mid)', background: 'var(--surface-0)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Title (English)">
              <input className="f-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="Title (Urdu)">
              <input className="f-input" style={{ direction: 'rtl' }} value={form.title_ur} onChange={(e) => setForm((f) => ({ ...f, title_ur: e.target.value }))} />
            </Field>
          </div>
          <Field label="Specific Instructions">
            <textarea className="f-input" rows={2} style={{ resize: 'vertical' }} value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="Any specific instructions for this particular homework…" />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
              />
              Published (visible to students when due date arrives)
            </label>
            <Button size="sm" variant="primary" onClick={() => mut.mutate()} isLoading={mut.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Content Assignment Modal */}
      {showAssignModal && (
        <AssignContentModal
          courseId={courseId}
          assignment={assignment}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      {/* Grid Sheet Preview Modal */}
      {showGridModal && (
        <HomeworkGridModal
          open={showGridModal}
          onClose={() => setShowGridModal(false)}
          assignment={assignment}
          readOnly={true}
        />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HomeworkAssignmentsManager({ courseId, course }) {
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['homework-schedule', courseId],
    queryFn: () => getHomeworkSchedule(courseId),
    staleTime: 60_000,
  });

  const scheduleData = data?.data ?? data;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  const hasSchedule = !!scheduleData?.schedule;
  const assignments = scheduleData?.assignments ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Schedule form — shown when no schedule or editing */}
      {(!hasSchedule || showForm) && (
        <ScheduleForm
          courseId={courseId}
          course={course}
          existing={hasSchedule ? scheduleData : null}
          onSaved={() => setShowForm(false)}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* If schedule exists, show summary + edit toggle */}
      {hasSchedule && !showForm && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
              📅 {getFrequencyLabel(scheduleData.schedule.frequency)} Schedule
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: 4, display: 'flex', gap: 16 }}>
              <span><strong>{scheduleData.schedule.total_assignments}</strong> assignments</span>
              {scheduleData.schedule.first_due_date && (
                <span>First due: <strong>{new Date(scheduleData.schedule.first_due_date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            ✎ Edit Schedule
          </Button>
        </div>
      )}

      {/* Assignment list */}
      {hasSchedule && assignments.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 12 }}>
            Assignment Slots ({assignments.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assignments.map((a) => (
              <AssignmentRow key={a.id} assignment={a} courseId={courseId} />
            ))}
          </div>
        </div>
      )}

      {/* No schedule yet */}
      {!hasSchedule && !showForm && (
        <EmptyState
          icon="📋"
          title="No Homework Schedule Yet"
          description="Create a schedule to auto-generate homework assignments for all students enrolled in this course across all centers."
          action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Create Schedule</Button>}
        />
      )}
    </div>
  );
}
