import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getHomeworkSchedule, updateHomeworkAssignment, applyHomeworkDates } from '../../../api/homework';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import HomeworkGridModal, { HomeworkGridSheetView } from './HomeworkGridModal';
import { useToast } from '../../../hooks/useToast';
import { BookIcon, UserIcon, CalendarIcon } from '../../../components/Icons';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGapDays(frequency) {
  switch (frequency) {
    case 'daily': return 1;
    case 'after_2_days': return 2;
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30;
    default: return 7;
  }
}

/**
 * Resolve a due date for an assignment:
 * 1. Use the DB `due_date` if present.
 * 2. Fall back to computing from cls.start_date + idx * gapDays.
 */
function resolveDueDate(assignment, idx, startDateStr, frequency) {
  if (assignment.due_date) return assignment.due_date;
  if (!startDateStr) return '';
  // Normalize: strip any existing time/timezone part so we only work with YYYY-MM-DD
  const datePart = String(startDateStr).split('T')[0];
  const d = new Date(datePart + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  const gapDays = getGapDays(frequency);
  d.setUTCDate(d.getUTCDate() + idx * gapDays);
  return d.toISOString().split('T')[0];
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';

  const date = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00`);

  if (isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
/**
 * Status logic:
 * - is_fully_marked → all students fully graded → 'marked'
 * - has_any_marks   → some students have marks  → 'in_progress'
 * - due_date < today → overdue and no marks      → 'pending'
 * - otherwise        → upcoming
 */
function getAssignmentStatus(dueDateStr, isFullyMarked, hasAnyMarks, isPublished = true) {
  if (isFullyMarked) return 'marked';
  if (hasAnyMarks) return 'in_progress';
  if (isPublished || dueDateStr) return 'pending';
  return 'upcoming';
}

function StatusBadge({ status }) {
  if (status === 'marked') return <Badge variant="blue">Marked</Badge>;
  if (status === 'in_progress') return <Badge variant="gold">In Progress</Badge>;
  if (status === 'pending') return <Badge variant="red">Pending</Badge>;
  return <Badge variant="sand">Upcoming</Badge>;
}

// ── Inline editable due date cell ────────────────────────────────────────────

function DueDateCell({ assignment, courseId, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(assignment.due_date ?? '');
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (date) => updateHomeworkAssignment(courseId, assignment.id, { due_date: date || null }),
    onSuccess: () => {
      toast.success('Due date updated.');
      setEditing(false);
      onSaved();
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message ?? 'Failed to update due date.');
    },
  });

  if (!canEdit) {
    return (
      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
        {fmtDate(assignment.due_date)}
      </span>
    );
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="date"
          className="f-input"
          style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button
          style={{
            background: 'var(--emerald)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 12,
            cursor: 'pointer', fontWeight: 600,
          }}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(value)}
        >
          {mutation.isPending ? '…' : 'Save'}
        </button>
        <button
          style={{
            background: 'none', color: 'var(--ink-pale)', border: '1px solid var(--sand-mid)',
            borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12, cursor: 'pointer',
          }}
          onClick={() => { setEditing(false); setValue(assignment.due_date ?? ''); }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      title="Click to edit due date"
      onClick={() => { setValue(assignment.due_date ?? ''); setEditing(true); }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        color: assignment.due_date ? 'var(--ink-soft)' : 'var(--ink-pale)',
        fontSize: 13,
        padding: 0,
      }}
    >
      {fmtDate(assignment?.due_date)}
      <span style={{ fontSize: 11, color: 'var(--emerald)', opacity: 0.8 }}>✎</span>
    </button>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color = 'var(--ink)', accent }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: `1px solid ${accent ?? 'var(--sand-mid)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClassHomeworkTab({ courseId, classId, cls }) {
  const { role } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = role === 'center_manager' || role === 'super_admin';

  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);

  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ['homework-schedule', courseId, classId],
    queryFn: () => getHomeworkSchedule(courseId, classId),
    enabled: !!courseId,
    staleTime: 0,
  });

  const applyDatesMutation = useMutation({
    mutationFn: () => applyHomeworkDates(courseId, firstDueDate),
    onSuccess: () => {
      toast.success('Due dates applied to all assignments.');
      setShowSchedulePanel(false);
      setFirstDueDate('');
      qc.invalidateQueries({ queryKey: ['homework-schedule', courseId] });
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message ?? 'Failed to apply due dates.');
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'var(--red-light)', color: 'var(--red)',
        borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13,
      }}>
        Failed to load homework assignments.
      </div>
    );
  }

  const scheduleData = schedule?.data ?? schedule;
  const rawAssignments = scheduleData?.assignments || [];
  const scheduleInfo = scheduleData?.schedule ?? null;
  const frequency = scheduleInfo?.frequency || 'weekly';
  const startDateStr = cls?.start_date;

  // Attach resolved due date to each assignment
  const assignments = rawAssignments.map((a, idx) => ({
    ...a,
    resolved_due_date: resolveDueDate(a, idx, startDateStr, frequency),
  }));



  // ── Summary card counts ──────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalScheduled = scheduleInfo?.total_assignments ?? assignments.length;
  const totalPublished = assignments.filter((a) => a.is_published).length;

  const completedCount = assignments.filter((a) => a.is_published && a.is_fully_marked).length;
  const remainingCount = assignments.filter((a) => !a.is_published || !a.is_fully_marked).length;

  // Last due date among all assignments
  const lastDueDate = assignments
    .filter((a) => a.resolved_due_date)
    .map((a) => a.resolved_due_date)
    .sort()
    .at(-1);

  const hasDueDates = assignments.some((a) => a.resolved_due_date);

  function handleRowClick(a) {
    // Only published assignments are interactive for teachers and center managers
    if (!a.is_published) return;
    setSelectedAssignment(a);
  }

  if (selectedAssignment) {
    return (
      <HomeworkGridSheetView
        assignment={selectedAssignment}
        classId={classId}
        readOnly={false}
        onBack={() => {
          setSelectedAssignment(null);
          qc.invalidateQueries({ queryKey: ['homework-schedule', courseId, classId] });
        }}
        asPage={true}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Schedule panel hint (if no due dates set) ── */}
      {canManage && !hasDueDates && (
        <div style={{
          background: 'var(--gold-light, #fef9ec)', border: '1px solid var(--gold, #d97706)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>No due dates set</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              Set the first assignment due date to auto-schedule all {totalScheduled} assignments
              using the <strong>{frequency}</strong> frequency.
            </div>
          </div>
          <button
            onClick={() => setShowSchedulePanel((v) => !v)}
            style={{
              background: 'var(--emerald)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Set Due Dates
          </button>
        </div>
      )}

      {/* ── Bulk reschedule panel ── */}
      {canManage && showSchedulePanel && (
        <div style={{
          background: 'var(--white)', border: '1.5px solid var(--emerald)',
          borderRadius: 'var(--radius-md)', padding: '20px',
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>
            Set First Assignment Due Date
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginBottom: 16 }}>
            The system will automatically calculate all {totalScheduled} assignment due dates
            using the admin-configured <strong>{frequency}</strong> frequency
            ({getGapDays(frequency)} day{getGapDays(frequency) !== 1 ? 's' : ''} apart).
            Individual due dates can still be edited after this.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-pale)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                First Assignment Due Date
              </label>
              <input
                type="date"
                className="f-input"
                style={{ width: 180 }}
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button
                onClick={() => applyDatesMutation.mutate()}
                disabled={!firstDueDate || applyDatesMutation.isPending}
                style={{
                  background: !firstDueDate ? 'var(--sand-mid)' : 'var(--emerald)',
                  color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                  padding: '8px 20px', fontSize: 13, fontWeight: 600,
                  cursor: firstDueDate ? 'pointer' : 'not-allowed',
                }}
              >
                {applyDatesMutation.isPending ? 'Applying…' : 'Apply Schedule'}
              </button>
              <button
                onClick={() => setShowSchedulePanel(false)}
                style={{
                  background: 'none', border: '1px solid var(--sand-mid)',
                  borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                  fontSize: 13, cursor: 'pointer', color: 'var(--ink-pale)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set / reschedule button (when dates are already set) ── */}
      {canManage && hasDueDates && !showSchedulePanel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowSchedulePanel(true)}
            style={{
              background: 'none', border: '1px solid var(--sand-mid)',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px',
              fontSize: 12, cursor: 'pointer', color: 'var(--ink-soft)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🗓 Reschedule All
          </button>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <SummaryCard
          label="Scheduled"
          value={totalScheduled}
          color="var(--ink)"
        />
        <SummaryCard
          label="Published"
          value={totalPublished}
          color="var(--emerald)"
          accent="var(--emerald-light)"
        />
        <SummaryCard
          label="Completed"
          value={completedCount}
          color="var(--blue)"
          accent="var(--blue-light)"
        />
        <SummaryCard
          label="Remaining"
          value={remainingCount}
          color="var(--ink-soft)"
        />
      </div>

      {/* ── Schedule info strip ── */}
      {scheduleInfo && (
        <div style={{
          background: 'var(--sand-light)', borderRadius: 'var(--radius-sm)',
          padding: '10px 16px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            <strong>Frequency:</strong> {scheduleInfo.frequency?.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            <strong>Total Assignments:</strong> {scheduleInfo.total_assignments}
          </span>
          {lastDueDate && (
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              <strong>Final Due Date:</strong> {fmtDate(lastDueDate)}
            </span>
          )}
          {scheduleInfo.instructions && (
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
              {scheduleInfo.instructions}
            </span>
          )}
        </div>
      )}

      {/* ── Scheduled Assignments Table ── */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
          Scheduled Assignments
          {canManage ? (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-pale)', marginLeft: 10 }}>
              Click a due date to edit it • Click a row to view assignment
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-pale)', marginLeft: 10 }}>
              Click a row to view and evaluate assignment
            </span>
          )}
        </h3>

        {assignments.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={36} color="var(--emerald)" />}
            title="No assignments scheduled"
            description="The admin has not configured a homework schedule for this course yet."
          />
        ) : (
          <div style={{
            background: 'var(--white)', border: '1px solid var(--sand-mid)',
            borderRadius: 'var(--radius-md)', overflow: 'auto', boxShadow: 'var(--shadow-sm)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ background: 'var(--sand-light)' }}>
                  {['Seq #', 'Title', 'Due Date', 'Max Marks', 'Published', 'Status', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left', fontSize: 11, fontWeight: 600,
                        color: 'var(--ink-pale)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', padding: '12px 16px',
                        borderBottom: '1px solid var(--sand-mid)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {assignments.map((a, idx) => {
                  const status = getAssignmentStatus(a.resolved_due_date, a.is_fully_marked, a.has_any_marks, a.is_published);
                  const isLast = idx === assignments.length - 1;
                  const canOpen = Boolean(a.is_published);
                  const isClickable = canOpen;
                  return (
                    <tr
                      key={a.id}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--sand)',
                        cursor: isClickable ? 'pointer' : 'default',
                        transition: 'background 0.13s',
                        opacity: !a.is_published ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (isClickable) e.currentTarget.style.background = 'var(--sand-light)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onClick={() => handleRowClick(a)}
                      title={!a.is_published ? 'Not yet published by admin' : undefined}
                    >
                      {/* Seq # */}
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                        HW-{a.assignment_number ?? idx + 1}
                      </td>

                      {/* Title */}
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                        {a.title || `Homework ${a.assignment_number ?? idx + 1}`}
                        {a.title_ur && (
                          <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl' }}>
                            {a.title_ur}
                          </div>
                        )}
                      </td>

                      {/* Due Date — editable for managers */}
                      <td
                        style={{ padding: '12px 16px' }}
                        onClick={(e) => canManage && e.stopPropagation()}
                      >
                        <DueDateCell
                          assignment={{ ...a, due_date: a.resolved_due_date }}
                          courseId={courseId}
                          canEdit={canManage}
                          onSaved={() => qc.invalidateQueries({ queryKey: ['homework-schedule', courseId] })}
                        />
                      </td>

                      {/* Max Marks */}
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                        {a.total_marks ? `${a.total_marks}` : '—'}
                      </td>

                      {/* Published */}
                      <td style={{ padding: '12px 16px' }}>
                        {a.is_published
                          ? <Badge variant="green">Published</Badge>
                          : <Badge variant="sand">Draft</Badge>
                        }
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge status={status} />
                        {a.marked_by_teacher_name && (
                          <div style={{ fontSize: 11, color: 'var(--emerald, #059669)', marginTop: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <UserIcon size={12} color="var(--emerald, #059669)" /> {a.marked_by_teacher_name}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {canOpen ? (
                          <span style={{ fontSize: 12, color: 'var(--emerald)', fontWeight: 500 }}>
                            View →
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>
                            Not published
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
