import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import MetricCard from '../../../components/MetricCard';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Badge from '../../../components/Badge';
import EmptyState from '../../../components/EmptyState';
import { getStudentEnrollments } from '../../../api/enrollments';
import { getStudentClassDetail } from '../../../api/classes';

const STATUS_STYLE = {
  present: { dot: 'var(--emerald)',    bg: 'var(--emerald-light)', label: 'Present'  },
  absent:  { dot: 'var(--red)',        bg: 'var(--red-light)',     label: 'Absent'   },
  late:    { dot: 'var(--amber)',      bg: 'var(--gold-light)',    label: 'Late'     },
};

const STATUS_BADGE = {
  present: 'green',
  absent:  'red',
  late:    'gold',
};

// ── Calendar Grid ─────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, records, scheduleDays, startDate }) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0,0,0,0);

  const byDay = {};
  records.forEach(r => {
    const d = new Date(r.session_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay[d.getDate()] = r;
    }
  });

  // Starting blank cells (Mon=0 … Sun=6)
  const startBlank = (firstDay.getDay() + 6) % 7; // shift so Mon=0
  const days = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);

  const cellBase = { width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const allowedDays = new Set((scheduleDays || '').toLowerCase().split(',').map(d => d.trim()));

  const startDt = startDate ? new Date(startDate) : new Date(0);
  startDt.setHours(0,0,0,0);

  return (
    <div>
      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 4, marginBottom: 4 }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ ...cellBase, fontSize: 10, color: 'var(--ink-pale)', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 4 }}>
        {Array.from({ length: startBlank }).map((_, i) => <div key={'b' + i} style={cellBase} />)}
        {days.map((day) => {
          const rec = byDay[day];
          const st  = rec ? STATUS_STYLE[rec.status] : null;
          const currentDt = new Date(year, month, day);
          currentDt.setHours(0,0,0,0);
          
          const dayNameIdx = (new Date(year, month, day).getDay() + 6) % 7;
          const dayName = dayNames[dayNameIdx].toLowerCase();
          const isAllowedDay = allowedDays.has(dayName) || allowedDays.has(dayName.substring(0,3));
          
          const isDisabled = !isAllowedDay || currentDt < startDt || currentDt > today;

          return (
            <div
              key={day}
              title={rec ? `${rec.session_date} — ${rec.status}` : undefined}
              style={{
                ...cellBase,
                background: st ? st.bg : (isDisabled ? 'var(--sand-light)' : 'transparent'),
                color: st ? (rec.status === 'absent' ? 'var(--red)' : rec.status === 'late' ? 'var(--amber)' : 'var(--emerald)') : (isDisabled ? 'var(--sand-mid)' : 'var(--ink-pale)'),
                border: st ? 'none' : (isDisabled ? 'none' : '1px solid var(--sand-mid)'),
                opacity: isDisabled && !st ? 0.4 : 1,
              }}
            >
              {day}
              {st && (
                <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MyAttendance() {
  const { user } = useAuth();
  
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const [selectedClassId, setSelectedClassId] = useState('');

  // 1. Fetch Enrollments for Classroom Selection
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => getStudentEnrollments(user.id),
    enabled: !!user?.id,
  });

  const enrollments = enrollmentsData?.data ?? enrollmentsData ?? [];
  const activeEnrollments = enrollments.filter(e => e.status === 'active');

  // Fetch classes to display names in dropdown
  const { data: classesData } = useQuery({
    queryKey: ['center-classes', user?.center_id],
    queryFn: () => import('../../../api/classes').then(m => m.getClasses(user.center_id, { is_active: true })),
    enabled: !!user?.center_id,
  });
  const availableClasses = classesData?.data ?? classesData ?? [];

  useEffect(() => {
    if (activeEnrollments.length > 0 && !selectedClassId) {
      setSelectedClassId(String(activeEnrollments[0].class_id));
    }
  }, [activeEnrollments, selectedClassId]);

  // 2. Fetch Details for Selected Class
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['student-class-detail', selectedClassId],
    queryFn: () => getStudentClassDetail(selectedClassId),
    enabled: !!selectedClassId,
  });

  if (enrollmentsLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  if (activeEnrollments.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <EmptyState icon="🏫" title="No Enrollments" description="You are not enrolled in any classes." />
      </div>
    );
  }

  const detail = classData?.data ?? classData ?? {};
  const cls = detail.class || {};
  
  // Extract attendance records from session plans
  const sessionPlans = detail.sessionPlans || [];
  const records = sessionPlans.filter(sp => sp.attendance).map(sp => ({
    id: sp.id,
    session_date: sp.session_date,
    status: sp.attendance.status,
    note_ur: sp.attendance.note_ur
  }));

  const summary = detail.attendanceSummary || { total: 0, present: 0, absent: 0, late: 0 };
  const pct = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : null;
  const pctColor = pct == null ? 'neutral' : pct >= 75 ? 'green' : pct >= 50 ? 'gold' : 'red';
  const pctLabel = pct != null ? `${pct}%` : '—';

  function navigateMonth(dir) {
    let m = month + dir;
    let y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonth(m); setYear(y);
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' };
  const tdStyle = (last) => ({ padding: '10px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: last ? 'none' : '1px solid var(--sand)' });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            My Attendance
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>View attendance history by class</p>
        </div>
        
        <div>
          <select 
            value={selectedClassId} 
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sand-mid)', fontSize: 14, background: 'var(--white)', color: 'var(--ink)' }}
          >
            {activeEnrollments.map(enr => {
              const matchedClass = availableClasses.find(c => c.id === enr.class_id);
              return (
                <option key={enr.class_id} value={enr.class_id}>
                  {matchedClass ? `${matchedClass.course_name} (${matchedClass.name})` : `Class ID: ${enr.class_id}`}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {classLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>
      ) : (
        <>
          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <MetricCard label="Present"    value={summary.present    ?? '—'} variant="green"   />
            <MetricCard label="Absent"     value={summary.absent     ?? '—'} variant="red"     />
            <MetricCard label="Late"       value={summary.late       ?? '—'} variant="gold"    />
            <MetricCard label="Attendance" value={pctLabel}                  variant={pctColor} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Calendar */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button onClick={() => navigateMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-pale)', padding: '2px 6px' }}>←</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{monthName}</span>
                <button onClick={() => navigateMonth(1)}  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-pale)', padding: '2px 6px' }}>→</button>
              </div>
              <div style={{ position: 'relative' }}>
                <CalendarGrid 
                  year={year} 
                  month={month} 
                  records={records} 
                  scheduleDays={cls.schedule_days} 
                  startDate={cls.start_date} 
                />
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_STYLE).map(([s, st]) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-soft)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot }} />
                    {st.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Sessions table */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sand-mid)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Attended Sessions ({records.length})
              </div>
              {records.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-pale)' }}>No records for this class.</div>
              ) : (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Date', 'Status', 'Note'].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...records].sort((a, b) => b.session_date.localeCompare(a.session_date)).map((r, i, arr) => (
                        <tr key={r.id ?? r.session_date}>
                          <td style={tdStyle(i === arr.length - 1)}>
                            <span style={{ fontSize: 13 }}>{new Date(r.session_date).toLocaleDateString()}</span>
                          </td>
                          <td style={tdStyle(i === arr.length - 1)}>
                            <Badge variant={STATUS_BADGE[r.status] ?? 'sand'}>{r.status}</Badge>
                          </td>
                          <td style={{ ...tdStyle(i === arr.length - 1), direction: 'rtl', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--ink-soft)' }}>
                            {r.note_ur ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
