import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import RTLInput from './RTLInput';
import { useToast } from '../hooks/useToast';
import { getClassEnrollments } from '../api/classes';
import { getClassAttendance, createAttendanceSession, updateRecord, getSessionRecords } from '../api/attendance';
import { formatTimeShort } from '../utils/classSessions';

const STATUS_STYLE = {
  present: { bg: 'var(--emerald)', color: 'var(--white)', label: 'P' },
  absent: { bg: 'var(--red)', color: 'var(--white)', label: 'A' },
  late: { bg: 'var(--amber)', color: 'var(--white)', label: 'L' },
};

const STATUS_BADGE = {
  present: 'chip chip-green',
  absent: 'chip chip-red',
  late: 'chip chip-gold',
};

const STATUSES = ['present', 'absent', 'late'];

// Local date normalization to avoid timezone mismatches
function normalizeDateStr(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).split('T')[0];
}
function AttendanceRow({ student, record, editable, onChange }) {
  const status = record?.status ?? 'present';
  const noteUr = record?.note_ur ?? '';
  const id = student.student_user_id ?? student.id;

  if (!editable) {
    const badge = STATUS_BADGE[status] ?? 'chip chip-sand';
    return (
      <tr>
        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{student.full_name ?? '—'}</td>
        <td style={{ padding: '10px 12px', fontSize: 12, direction: 'rtl', fontFamily: 'var(--font-display)' }}>
          {student.full_name_ur ?? '—'}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <span className={badge} style={{ fontSize: 11 }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </td>
      </tr>
    );
  }

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--sand-mid)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{student.full_name ?? '—'}</div>
          {student.full_name_ur && (
            <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>
              {student.full_name_ur}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {STATUSES.map((s) => {
            const st = STATUS_STYLE[s];
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange(id, { status: s, note_ur: s !== 'absent' ? '' : noteUr })}
                style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--radius-sm)',
                  border: active ? 'none' : '1.5px solid var(--sand-deep)',
                  background: active ? st.bg : 'var(--white)',
                  color: active ? st.color : 'var(--ink-pale)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
                title={s.charAt(0).toUpperCase() + s.slice(1)}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>
      {status === 'absent' && (
        <div style={{ marginTop: 8 }}>
          <RTLInput
            placeholder="وجہ غیر حاضری — optional"
            value={noteUr}
            onChange={(e) => onChange(id, { status: 'absent', note_ur: e.target.value })}
            style={{ fontSize: 13 }}
          />
        </div>
      )}
    </div>
  );
}

export default function SessionAttendanceModal({
  open,
  onClose,
  classId,
  attendanceSessionId,
  sessionId,
  sessionDate,
  dayOfWeek,
  startTime,
  endTime,
  mode = 'mark',
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState(false);
  const editable = mode === 'mark';
  // Reset the state whenever the modal closes
  useEffect(() => {
    if (!open) {
      setRecords({});
    }
  }, [open]);

  const { data: enrollmentsRaw = [], isLoading: enrollLoading } = useQuery({
    queryKey: ['class-enrollments', classId, 'active'],
    queryFn: () => getClassEnrollments(classId, { status: 'active' }),
    enabled: open && !!classId,
    staleTime: 30_000,
  });

  const { data: sessionsRaw = [], isLoading: sessionLoading } = useQuery({
    queryKey: ['class-attendance', classId, sessionDate],
    queryFn: () => getClassAttendance(classId, { from: sessionDate, to: sessionDate }),
    enabled: open && !!classId && !!sessionDate,
    staleTime: 15_000,
  });

  const students = enrollmentsRaw?.data ?? enrollmentsRaw ?? [];
  const sessions = sessionsRaw?.data ?? sessionsRaw ?? [];
  // Match existing sessions by explicit IDs, with a safe date-normalization fallback
  const existingSession = Array.isArray(sessions)
    ? sessions.find(
      (s) =>
        (attendanceSessionId && (s.session_id === attendanceSessionId || s.id === attendanceSessionId)) ||
        (sessionId && (s.session_id === sessionId || s.id === sessionId)) ||
        normalizeDateStr(s.session_date) === normalizeDateStr(sessionDate)
    )
    : null;

  // Fetch the individual records for the matched session — listSessionsByClass only
  // returns summary counts; we need the per-student record_ids to PATCH them.
  const existingSessionId = existingSession?.session_id ?? existingSession?.id;
  const { data: sessionRecordsRaw = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['attendance-records', existingSessionId],
    queryFn: () => getSessionRecords(existingSessionId),
    enabled: open && !!existingSessionId,
    staleTime: 15_000,
  });
  const sessionRecords = sessionRecordsRaw?.data ?? sessionRecordsRaw ?? [];

  useEffect(() => {
    // Stop if modal is closed, students haven't loaded, or session data is loading.
    if (!open || !students.length || sessionLoading) return;
    
    // Stop if we have ALREADY initialized `records` for this session!
    // This entirely prevents infinite re-rendering loops and reverting user clicks.
    if (Object.keys(records).length > 0) return;

    if (existingSession) {
      // Wait for individual records to load before populating edit state
      if (recordsLoading) return;
      const map = {};
      sessionRecords.forEach((r) => {
        map[r.student_user_id] = {
          status: r.status,
          note_ur: r.note_ur ?? '',
          record_id: r.record_id ?? r.id, // handle both aliases just in case
        };
      });
      // Fill in any enrolled students not yet in the records
      students.forEach((s) => {
        const id = s.student_user_id ?? s.id;
        if (!map[id]) map[id] = { status: 'present', note_ur: '' };
      });
      setRecords(map);
    } else {
      // New session — initialize all students as present
      const map = {};
      students.forEach((s) => {
        map[s.student_user_id ?? s.id] = { status: 'present', note_ur: '' };
      });
      setRecords(map);
    }
  }, [open, students, sessionLoading, existingSession, recordsLoading, sessionRecords, records]);



  const counts = useMemo(() => {
    const vals = Object.values(records);
    return {
      present: vals.filter((r) => r.status === 'present').length,
      absent: vals.filter((r) => r.status === 'absent').length,
      late: vals.filter((r) => r.status === 'late').length,
      total: vals.length,
    };
  }, [records]);

  function handleChange(studentId, update) {
    setRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...update } }));
  }

  function markAll(status) {
    const map = {};
    students.forEach((s) => {
      map[s.student_user_id ?? s.id] = { status, note_ur: '' };
    });
    setRecords(map);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const recordsPayload = students.map((s) => {
        const id = s.student_user_id ?? s.id;
        const rec = records[id] ?? { status: 'present', note_ur: '' };
        return {
          student_user_id: id,
          status: rec.status,
          ...(rec.note_ur ? { note_ur: rec.note_ur } : {}),
        };
      });

      const attendanceId =
        existingSession?.session_id ||
        existingSession?.id ||
        attendanceSessionId ||
        sessionId;

      if (attendanceId) {
        // Edit existing records — use record_id stored in local state map (DB alias)
        await Promise.all(
          students.map(async (s) => {
            const id = s.student_user_id ?? s.id;
            const rec = records[id];
            // Find the original record from our separately-fetched sessionRecords
            const original = sessionRecords.find((r) => r.student_user_id === id);
            if (!rec || !original?.record_id) return; // skip if no record to update
            const statusChanged = original.status !== rec.status;
            const noteChanged = (original.note_ur ?? '') !== (rec.note_ur ?? '');
            if (statusChanged || noteChanged) {
              const updatePayload = { status: rec.status };
              // Only include note_ur if it's a non-empty string — backend schema rejects null
              if (rec.note_ur) updatePayload.note_ur = rec.note_ur;
              await updateRecord(attendanceId, original.record_id, updatePayload);
            }
          }),
        );
      } else {
        await createAttendanceSession(classId, {
          session_date: sessionDate,
          records: recordsPayload,
        });
      }

      await qc.invalidateQueries({ queryKey: ['class-attendance', classId] });
      if (attendanceId) {
        await qc.invalidateQueries({ queryKey: ['attendance-records', attendanceId] });
      }
      toast.success(`Attendance saved for ${sessionDate}.`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  }

  const subtitle = [
    dayOfWeek,
    sessionDate ? new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    startTime ? `${formatTimeShort(startTime)}${endTime ? ` – ${formatTimeShort(endTime)}` : ''}` : '',
  ].filter(Boolean).join(' · ');

  const isLoading = enrollLoading || sessionLoading || (!!existingSessionId && recordsLoading);
  const title = editable
    ? (existingSession ? 'Edit Attendance' : 'Mark Attendance')
    : 'Attendance Sheet';

  return (
    <Modal open={open} title={title} size="lg" onClose={onClose}>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: -8, marginBottom: 16 }}>{subtitle}</div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-pale)', fontSize: 13 }}>
          No enrolled students in this classroom.
        </div>
      ) : editable ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Student Attendance — {students.length} enrolled
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="outline" onClick={() => markAll('present')}>All Present</Button>
              <Button size="sm" variant="outline" onClick={() => markAll('absent')}>All Absent</Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '10px 14px', background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
            <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Present: {counts.present}</span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>Absent: {counts.absent}</span>
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Late: {counts.late}</span>
          </div>

          {students.map((s) => (
            <AttendanceRow
              key={s.student_user_id ?? s.id}
              student={s}
              record={records[s.student_user_id ?? s.id]}
              editable
              onChange={handleChange}
            />
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--sand-mid)' }}>
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Attendance'}
            </Button>
          </div>
        </>
      ) : !existingSession ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-pale)', fontSize: 13 }}>
          No attendance has been marked for this class yet.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Present', value: counts.present, color: 'var(--emerald)' },
              { label: 'Absent', value: counts.absent, color: 'var(--red)' },
              { label: 'Late', value: counts.late, color: 'var(--amber)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{label}</div>
              </div>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--sand-light)' }}>
                {['Student', 'Urdu Name', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-pale)', textTransform: 'uppercase', padding: '8px 12px', borderBottom: '1px solid var(--sand-mid)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <AttendanceRow
                  key={s.student_user_id ?? s.id}
                  student={s}
                  record={records[s.student_user_id ?? s.id]}
                  editable={false}
                />
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--sand-mid)' }}>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
