import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import { usePermissions } from '../../../hooks/usePermissions';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { useCorrectRecord } from '../../../hooks/useAttendance';
import { useToast } from '../../../hooks/useToast';
import { getClasses, getClassEnrollments } from '../../../api/classes';
import { getClassAttendance } from '../../../api/attendance';

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_MS = 86_400_000;

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().slice(0, 10); }

function weekStart(dateStr) {
  const d  = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday-based week
  return new Date(d.getTime() + diff * DAY_MS);
}

function monthStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthEnd(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d, n) { return new Date(d.getTime() + n * DAY_MS); }

function formatDate(d) {
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

// ── Cell status chip ──────────────────────────────────────────────────────────
const STATUS_CHIP = {
  present:  { cls: 'chip chip-green', short: 'P' },
  absent:   { cls: 'chip chip-red',   short: 'A' },
  late:     { cls: 'chip chip-gold',  short: 'L' },
};

function StatusCell({ record, sessionId, classId, onCorrected, editable = true }) {
  const toast   = useToast();
  const correct = useCorrectRecord();
  const [editing, setEditing] = useState(false);

  if (!record) return <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: 'var(--ink-pale)' }}>—</td>;

  const chip = STATUS_CHIP[record.status] ?? { cls: 'chip chip-sand', short: '?' };

  async function handleCorrect(newStatus) {
    try {
      await correct.mutateAsync({ sessionId, recordId: record.id, classId, payload: { status: newStatus } });
      toast.success('Record corrected.');
      onCorrected?.();
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to correct record.');
    }
  }

  if (editing) {
    return (
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
          {['present', 'absent', 'late'].map((s) => (
            <button
              key={s}
              onClick={() => handleCorrect(s)}
              style={{
                width: 24, height: 24, borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: s === 'present' ? 'var(--emerald)' : s === 'absent' ? 'var(--red)' : 'var(--amber)',
                color: 'white',
              }}
            >
              {s[0].toUpperCase()}
            </button>
          ))}
          <button onClick={() => setEditing(false)} style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--sand-deep)', background: 'white', cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>
      </td>
    );
  }

  return (
    <td
      style={{ padding: '8px 10px', textAlign: 'center', cursor: editable ? 'pointer' : 'default' }}
      onClick={() => { if (editable) setEditing(true); }}
      title={editable ? 'Click to correct' : undefined}
    >
      <span className={chip.cls} style={{ fontSize: 10, padding: '2px 7px' }}>{chip.short}</span>
    </td>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(students, dates, sessionMap) {
  const header = ['Student', 'Urdu Name', ...dates.map((d) => toISO(d)), 'Attendance %'];
  const rows = students.map((s) => {
    const id = s.student_user_id ?? s.id;
    let present = 0, total = 0;
    const cells = dates.map((d) => {
      const sess = sessionMap[toISO(d)];
      if (!sess) return '—';
      const rec = sess.records?.find((r) => r.student_user_id === id);
      if (!rec) return '—';
      total++;
      if (rec.status === 'present' || rec.status === 'late') present++;
      return rec.status[0].toUpperCase();
    });
    const pct = total > 0 ? Math.round((present / total) * 100) + '%' : '—';
    return [s.full_name ?? '', s.full_name_ur ?? '', ...cells, pct];
  });

  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Urdu
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'attendance.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AttendanceSheet() {
  const { user }   = useAuth();
  const { can }    = usePermissions();
  const centerId   = user?.center_id;

  const [selectedClass, setSelectedClass] = useState('');
  const [mode,          setMode]          = useState('week');  // 'week' | 'month'
  const [anchor,        setAnchor]        = useState(new Date().toISOString().slice(0, 10));

  // Compute date range
  const { from, to, dates } = useMemo(() => {
    if (mode === 'week') {
      const start = weekStart(anchor);
      const d = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { from: toISO(d[0]), to: toISO(d[6]), dates: d };
    } else {
      const start = monthStart(anchor);
      const end   = monthEnd(anchor);
      const count = end.getDate();
      const d = Array.from({ length: count }, (_, i) => addDays(start, i));
      return { from: toISO(start), to: toISO(end), dates: d };
    }
  }, [anchor, mode]);

  function navigate(dir) {
    const d = new Date(anchor + 'T00:00:00');
    if (mode === 'week') {
      setAnchor(toISO(addDays(d, dir * 7)));
    } else {
      const nm = new Date(d.getFullYear(), d.getMonth() + dir, 1);
      setAnchor(toISO(nm));
    }
  }

  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes', centerId],
    queryFn:  () => getClasses(centerId, { is_active: true }),
    staleTime: 5 * 60_000,
    enabled:  !!centerId,
  });

  const { data: enrollmentsRaw = [] } = useQuery({
    queryKey:  ['class-enrollments', selectedClass, 'active'],
    queryFn:   () => getClassEnrollments(selectedClass, { status: 'active' }),
    staleTime: 2 * 60_000,
    enabled:   !!selectedClass,
  });

  const { data: attendanceRaw = [], isLoading, refetch } = useQuery({
    queryKey:  ['class-attendance', selectedClass, from, to],
    queryFn:   () => getClassAttendance(selectedClass, { from, to }),
    staleTime: 60_000,
    enabled:   !!selectedClass,
  });

  const classes    = classesRaw?.data   ?? classesRaw   ?? [];
  const students   = (enrollmentsRaw?.data ?? enrollmentsRaw ?? []);
  const sessions   = attendanceRaw?.data ?? attendanceRaw ?? [];

  // Map sessions by date
  const sessionMap = useMemo(() => {
    const m = {};
    (Array.isArray(sessions) ? sessions : []).forEach((s) => { m[s.session_date] = s; });
    return m;
  }, [sessions]);

  // Per-student attendance % over visible range
  function studentPct(studentId) {
    let present = 0, total = 0;
    dates.forEach((d) => {
      const sess = sessionMap[toISO(d)];
      if (!sess) return;
      const rec = sess.records?.find((r) => r.student_user_id === studentId);
      if (!rec) return;
      total++;
      if (rec.status !== 'absent') present++;
    });
    return total > 0 ? Math.round((present / total) * 100) : null;
  }

  // Per-day class %
  function dayPct(dateStr) {
    const sess = sessionMap[dateStr];
    if (!sess || !sess.records?.length) return null;
    const present = sess.records.filter((r) => r.status !== 'absent').length;
    return Math.round((present / sess.records.length) * 100);
  }

  const rangeLabel = mode === 'week'
    ? `${formatDate(new Date(from + 'T00:00:00'))} – ${formatDate(new Date(to + 'T00:00:00'))}`
    : new Date(anchor + 'T00:00:00').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });

  const thBase = { fontSize: 10, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px', borderBottom: '1px solid var(--sand-mid)', textAlign: 'center', whiteSpace: 'nowrap' };
  const tdBase = { padding: '8px 12px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: '1px solid var(--sand)', verticalAlign: 'middle' };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Attendance sheet
        </h2>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="f-select"
          style={{ width: 200 }}
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">— Select class —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Week / Month toggle */}
        <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--sand-deep)' }}>
          {['week', 'month'].map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 500, background: mode === m ? 'var(--emerald-light)' : 'white', color: mode === m ? 'var(--emerald)' : 'var(--ink-soft)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{m}</button>
          ))}
        </div>

        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'var(--white)', border: '1.5px solid var(--sand-deep)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '6px 10px', fontSize: 13 }}>←</button>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', minWidth: 160, textAlign: 'center' }}>{rangeLabel}</span>
          <button onClick={() => navigate(1)}  style={{ background: 'var(--white)', border: '1.5px solid var(--sand-deep)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '6px 10px', fontSize: 13 }}>→</button>
        </div>

        {selectedClass && students.length > 0 && (
          <Can permission="attendance.export">
            <Button size="sm" variant="outline" onClick={() => exportCSV(students, dates, sessionMap)}>
              Export CSV
            </Button>
          </Can>
        )}
      </div>

      {!selectedClass ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--ink-pale)' }}>Select a class to view the attendance sheet.</div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>
      ) : students.length === 0 ? (
        <EmptyState icon="☑" title="No enrolled students" description="This class has no active enrollments." />
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: 'left', padding: '8px 14px', minWidth: 140 }}>Student</th>
                {dates.map((d) => {
                  const ds  = toISO(d);
                  const pct = dayPct(ds);
                  const hasSession = !!sessionMap[ds];
                  return (
                    <th key={ds} style={{ ...thBase, background: hasSession ? 'var(--sand)' : 'transparent' }}>
                      <div>{d.toLocaleDateString('en', { weekday: 'short' })}</div>
                      <div style={{ fontWeight: 400, fontSize: 9 }}>{formatDate(d)}</div>
                      {pct !== null && <div style={{ color: pct >= 75 ? 'var(--emerald)' : 'var(--red)', fontSize: 10, fontWeight: 600 }}>{pct}%</div>}
                    </th>
                  );
                })}
                <th style={{ ...thBase }}>%</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, si) => {
                const id  = s.student_user_id ?? s.id;
                const pct = studentPct(id);
                const isLast = si === students.length - 1;
                return (
                  <tr key={id}>
                    <td style={{ ...tdBase, borderBottom: isLast ? 'none' : undefined, fontWeight: 500 }}>
                      <div>{s.full_name ?? '—'}</div>
                      {s.full_name_ur && <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>{s.full_name_ur}</div>}
                    </td>
                    {dates.map((d) => {
                      const ds   = toISO(d);
                      const sess = sessionMap[ds];
                      const rec  = sess?.records?.find((r) => r.student_user_id === id);
                      return (
                        <StatusCell
                          key={ds}
                          record={rec}
                          sessionId={sess?.session_id ?? sess?.id}
                          classId={selectedClass}
                          onCorrected={refetch}
                          editable={can('attendance.correct')}
                        />
                      );
                    })}
                    <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600, color: pct === null ? 'var(--ink-pale)' : pct >= 75 ? 'var(--emerald)' : 'var(--red)', borderBottom: isLast ? 'none' : undefined }}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
