import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import MetricCard from '../../../components/MetricCard';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Badge from '../../../components/Badge';
import { useStudentAttendance } from '../../../hooks/useAttendance';

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

// ── Calendar grid ─────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, records }) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Build day-of-month → record map
  const byDay = {};
  records.forEach((r) => {
    const d = new Date(r.session_date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay[d.getDate()] = r;
    }
  });

  // Starting blank cells (Mon=0 … Sun=6)
  const startBlank = (firstDay.getDay() + 6) % 7; // shift so Mon=0
  const days = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);

  const cellBase = { width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 };

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
          return (
            <div
              key={day}
              title={rec ? `${rec.session_date} — ${rec.status}` : undefined}
              style={{
                ...cellBase,
                background: st ? st.bg : 'transparent',
                color: st ? (rec.status === 'absent' ? 'var(--red)' : rec.status === 'late' ? 'var(--amber)' : 'var(--emerald)') : 'var(--ink-pale)',
                border: st ? 'none' : '1px solid var(--sand-mid)',
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

  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;

  const { data, isLoading } = useStudentAttendance(user?.id, { from, to });

  const summary = data ?? {};
  const records = summary.records ?? [];
  const pct     = summary.attendance_pct;

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

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          My Attendance
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Year {year}</p>
      </div>

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
            <CalendarGrid year={year} month={month} records={records} />
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
            All sessions ({records.length})
          </div>
          {records.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-pale)' }}>No records for this year.</div>
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
                        <span style={{ fontSize: 13 }}>{r.session_date}</span>
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
  );
}
