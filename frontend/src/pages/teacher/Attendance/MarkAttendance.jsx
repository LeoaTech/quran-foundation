import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import { useMarkAttendance } from '../../../hooks/useAttendance';
import { getClasses } from '../../../api/classes';
import { getClassEnrollments } from '../../../api/classes';
import { getClassAttendance } from '../../../api/attendance';

const STATUS_STYLE = {
  present: { bg: 'var(--emerald)',    color: 'var(--white)', label: 'P' },
  absent:  { bg: 'var(--red)',        color: 'var(--white)', label: 'A' },
  late:    { bg: 'var(--amber)',      color: 'var(--white)', label: 'L' },
};

const STATUSES = ['present', 'absent', 'late'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Single student row ────────────────────────────────────────────────────────
function StudentRow({ student, record, onChange }) {
  const status  = record?.status  ?? 'present';
  const noteUr  = record?.note_ur ?? '';

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--sand-mid)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {student.full_name ?? '—'}
          </div>
          {(student.full_name_ur) && (
            <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>
              {student.full_name_ur}
            </div>
          )}
        </div>

        {/* Status buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {STATUSES.map((s) => {
            const st = STATUS_STYLE[s];
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => onChange(student.student_user_id ?? student.id, { status: s, note_ur: s !== 'absent' ? '' : noteUr })}
                style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--radius-sm)',
                  border: active ? 'none' : '1.5px solid var(--sand-deep)',
                  background: active ? st.bg : 'var(--white)',
                  color: active ? st.color : 'var(--ink-pale)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                title={s.charAt(0).toUpperCase() + s.slice(1)}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Absent note */}
      {status === 'absent' && (
        <div style={{ marginTop: 8 }}>
          <RTLInput
            placeholder="وجہ غیر حاضری — optional"
            value={noteUr}
            onChange={(e) => onChange(student.student_user_id ?? student.id, { status: 'absent', note_ur: e.target.value })}
            style={{ fontSize: 13 }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MarkAttendance() {
  const { user }    = useAuth();
  const toast       = useToast();
  const centerId    = user?.center_id;

  const [selectedClass, setSelectedClass] = useState('');
  const [date,          setDate]          = useState(today());
  const [loaded,        setLoaded]        = useState(false);
  const [records,       setRecords]       = useState({}); // { studentId: { status, note_ur } }
  const [existingSession, setExisting]    = useState(null);

  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes', centerId],
    queryFn:  () => getClasses(centerId, { is_active: true }),
    staleTime: 5 * 60_000,
    enabled:  !!centerId,
  });
  const classes = classesRaw?.data ?? classesRaw ?? [];

  const { data: enrollmentsRaw = [], isLoading: enrollLoading } = useQuery({
    queryKey:  ['class-enrollments', selectedClass, 'active'],
    queryFn:   () => getClassEnrollments(selectedClass, { status: 'active' }),
    staleTime: 2 * 60_000,
    enabled:   !!selectedClass && loaded,
  });

  const { data: existingRaw, isLoading: sessionLoading } = useQuery({
    queryKey:  ['class-attendance', selectedClass, date, date],
    queryFn:   () => getClassAttendance(selectedClass, { from: date, to: date }),
    staleTime: 30_000,
    enabled:   !!selectedClass && loaded,
  });

  const students = enrollmentsRaw?.data ?? enrollmentsRaw ?? [];

  // When data loads, initialise record state
  useEffect(() => {
    if (!loaded || !students.length) return;

    const sessions = existingRaw?.data ?? existingRaw ?? [];
    const todaySession = Array.isArray(sessions) ? sessions.find((s) => s.session_date === date) : null;

    if (todaySession) {
      setExisting(todaySession);
      const map = {};
      (todaySession.records ?? []).forEach((r) => {
        map[r.student_user_id] = { status: r.status, note_ur: r.note_ur ?? '', record_id: r.id };
      });
      // fill in any missing students as present
      students.forEach((s) => {
        const id = s.student_user_id ?? s.id;
        if (!map[id]) map[id] = { status: 'present', note_ur: '' };
      });
      setRecords(map);
    } else {
      setExisting(null);
      const map = {};
      students.forEach((s) => {
        map[s.student_user_id ?? s.id] = { status: 'present', note_ur: '' };
      });
      setRecords(map);
    }
  }, [students, existingRaw, loaded, date]);

  const markMutation = useMarkAttendance(selectedClass);

  function handleChange(studentId, update) {
    setRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...update } }));
  }

  const counts = useMemo(() => {
    const vals = Object.values(records);
    return {
      present: vals.filter((r) => r.status === 'present').length,
      absent:  vals.filter((r) => r.status === 'absent').length,
      late:    vals.filter((r) => r.status === 'late').length,
      total:   vals.length,
    };
  }, [records]);

  async function handleSave() {
    const recordsPayload = students.map((s) => {
      const id  = s.student_user_id ?? s.id;
      const rec = records[id] ?? { status: 'present', note_ur: '' };
      return {
        student_user_id: id,
        status:          rec.status,
        ...(rec.note_ur ? { note_ur: rec.note_ur } : {}),
      };
    });

    try {
      await markMutation.mutateAsync({ session_date: date, records: recordsPayload });
      toast.success(`Attendance saved for ${date}.`);
      setLoaded(false); // force re-check
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save attendance.');
    }
  }

  const isLoading = loaded && (enrollLoading || sessionLoading);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Mark attendance
        </h2>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="f-group" style={{ flex: '0 0 220px' }}>
          <label className="f-label">Class</label>
          <select
            className="f-select"
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setLoaded(false); }}
          >
            <option value="">— Select class —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="f-group" style={{ flex: '0 0 160px' }}>
          <label className="f-label">Date</label>
          <input
            className="f-input"
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setLoaded(false); }}
          />
        </div>

        <Button
          variant="primary"
          disabled={!selectedClass}
          onClick={() => setLoaded(true)}
        >
          Load class
        </Button>
      </div>

      {/* Existing session banner */}
      {loaded && existingSession && (
        <div style={{ background: 'var(--gold-light)', border: '1px solid var(--sand-deep)', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: 13, color: 'var(--amber)', fontWeight: 500, marginBottom: 16 }}>
          Editing existing session — {existingSession.session_date}
        </div>
      )}

      {/* Roster */}
      {!loaded ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--ink-pale)', fontSize: 13 }}>
          Select a class and date, then click "Load class".
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : students.length === 0 ? (
        <EmptyState icon="○" title="No enrolled students" description="This class has no active enrollments." />
      ) : (
        <>
          {/* Live summary header */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '10px 16px', background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
            <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Present: {counts.present}</span>
            <span style={{ color: 'var(--red)',     fontWeight: 600 }}>Absent: {counts.absent}</span>
            <span style={{ color: 'var(--amber)',   fontWeight: 600 }}>Late: {counts.late}</span>
            <span style={{ color: 'var(--ink-pale)' }}>Total: {counts.total}</span>
          </div>

          {students.map((s) => {
            const id = s.student_user_id ?? s.id;
            return (
              <StudentRow
                key={id}
                student={s}
                record={records[id]}
                onChange={handleChange}
              />
            );
          })}
        </>
      )}

      {/* Sticky bottom bar */}
      {loaded && students.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0,
          background: 'var(--white)',
          borderTop: '1px solid var(--sand-mid)',
          padding: '12px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 40,
        }}>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            Present: <strong style={{ color: 'var(--emerald)' }}>{counts.present}</strong>
            {'  '}Absent: <strong style={{ color: 'var(--red)' }}>{counts.absent}</strong>
            {'  '}Late: <strong style={{ color: 'var(--amber)' }}>{counts.late}</strong>
            {'  '}Total: <strong>{counts.total}</strong>
          </span>
          <Button
            variant="primary"
            disabled={markMutation.isPending}
            onClick={handleSave}
          >
            {markMutation.isPending ? 'Saving…' : 'Save attendance'}
          </Button>
        </div>
      )}
    </div>
  );
}
