import { useParams } from 'react-router-dom';
import ProgressBar from '../../../components/ProgressBar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Badge from '../../../components/Badge';
import Button from '../../../components/Button';
import { useStudentReport } from '../../../hooks/useReports';

// ── Grade donut — CSS only ────────────────────────────────────────────────────
const GRADE_COLORS = {
  excellent: { color: 'var(--emerald)', bg: 'var(--emerald-light)', label: 'Excellent'  },
  good:      { color: 'var(--blue)',    bg: 'var(--blue-light)',    label: 'Good'       },
  average:   { color: 'var(--amber)',   bg: 'var(--gold-light)',    label: 'Average'    },
  revision:  { color: 'var(--red)',     bg: 'var(--red-light)',     label: 'Needs Rev.' },
};

function GradesBreakdown({ grades }) {
  const total = Object.values(grades).reduce((a, b) => a + b, 0);
  if (total === 0) return <p style={{ fontSize: 13, color: 'var(--ink-pale)' }}>No classwork sessions.</p>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {Object.entries(GRADE_COLORS).map(([key, style]) => {
        const count = grades[key] ?? 0;
        const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={key} style={{ background: style.bg, borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: style.color, lineHeight: 1, minWidth: 48 }}>
              {count}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: style.color }}>{style.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{pct}% of sessions</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly calendar dots ─────────────────────────────────────────────────────
function CalendarDots({ records, year, month }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = {};
  records.forEach((r) => {
    const d = new Date(r.session_date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay[d.getDate()] = r.status;
    }
  });
  const label = new Date(year, month, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
  return (
    <div style={{ marginRight: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-pale)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 10px)', gap: 3 }}>
        {Array.from({ length: daysInMonth }).map((_, d) => {
          const day = d + 1;
          const s   = byDay[day];
          return (
            <div
              key={day}
              title={s ? `${label} ${day} — ${s}` : undefined}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: s === 'present' ? 'var(--emerald-bright)' : s === 'absent' ? 'var(--red)' : s === 'late' ? 'var(--amber)' : 'var(--sand-mid)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Trend arrow ───────────────────────────────────────────────────────────────
function TrendArrow({ trend }) {
  if (trend == null) return '—';
  if (trend > 0) return <span style={{ color: 'var(--emerald)', fontSize: 14 }}>↑</span>;
  if (trend < 0) return <span style={{ color: 'var(--red)', fontSize: 14 }}>↓</span>;
  return <span style={{ color: 'var(--ink-pale)', fontSize: 14 }}>→</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StudentReport() {
  const { userId } = useParams();
  const { data, isLoading } = useStudentReport(userId);

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  if (!data) {
    return <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>Report not found.</div>;
  }

  const student       = data.student ?? {};
  const attPct        = data.attendance_pct;
  const totalSessions = data.total_sessions;
  const presentSessions = data.present_sessions;
  const grades        = data.classwork_grades ?? {};
  const hwAvg         = data.homework_avg_pct;
  const topics        = data.topics_covered ?? [];
  const assessments   = data.assessment_scores ?? [];
  const criteria      = data.homework_criteria_breakdown ?? [];
  const notes         = data.recent_notes ?? [];
  const attendanceRecs = data.attendance_records ?? [];

  const now = new Date();
  const last3Months = [
    { year: new Date(now.getFullYear(), now.getMonth() - 2, 1).getFullYear(), month: new Date(now.getFullYear(), now.getMonth() - 2, 1).getMonth() },
    { year: new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear(), month: new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() },
    { year: now.getFullYear(), month: now.getMonth() },
  ];

  const attColor = attPct >= 75 ? 'var(--emerald)' : attPct >= 60 ? 'var(--amber)' : 'var(--red)';

  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 14px 6px', borderBottom: '1px solid var(--sand-mid)' };
  const tdStyle = (last) => ({ padding: '8px 14px', fontSize: 12, color: 'var(--ink-mid)', borderBottom: last ? 'none' : '1px solid var(--sand)' });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Print button */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <Button variant="outline" onClick={() => window.print()}>Print report card</Button>
      </div>

      {/* ── HEADER — Report Card ── */}
      <div className="report-header" style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 20, boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-pale)', marginBottom: 8 }}>
            Quran Foundation LMS — Student Report Card
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--ink)', lineHeight: 1.15, marginBottom: 4 }}>
            {student.full_name ?? '—'}
          </h1>
          {student.full_name_ur && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 8 }}>
              {student.full_name_ur}
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-pale)' }}>
            {student.center_name  && <span>Center: <strong style={{ color: 'var(--ink-mid)' }}>{student.center_name}</strong></span>}
            {student.class_name   && <span>Class: <strong style={{ color: 'var(--ink-mid)' }}>{student.class_name}</strong></span>}
            {student.teacher_name && <span>Teacher: <strong style={{ color: 'var(--ink-mid)' }}>{student.teacher_name}</strong></span>}
            <span>Date: <strong style={{ color: 'var(--ink-mid)' }}>{new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
          </div>
        </div>
        <div style={{ textAlign: 'center', background: attPct != null ? (attPct >= 75 ? 'var(--emerald-light)' : attPct >= 60 ? 'var(--gold-light)' : 'var(--red-light)') : 'var(--sand-mid)', borderRadius: 'var(--radius-md)', padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: attColor, lineHeight: 1 }}>
            {attPct != null ? `${attPct}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>Attendance</div>
        </div>
      </div>

      {/* ── Section 1 — Attendance ── */}
      <div className="report-section" style={{ marginBottom: 20 }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>1. Attendance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, color: attColor, lineHeight: 1 }}>
                {attPct != null ? `${attPct}%` : '—'}
              </div>
              {presentSessions != null && totalSessions != null && (
                <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: 4 }}>
                  {presentSessions} of {totalSessions} sessions attended
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <ProgressBar value={attPct ?? 0} variant={attPct >= 75 ? 'green' : attPct >= 60 ? 'gold' : 'red'} height={10} />
            </div>
          </div>
          {attendanceRecs.length > 0 && (
            <div style={{ display: 'flex', gap: 16 }}>
              {last3Months.map((m) => (
                <CalendarDots key={`${m.year}-${m.month}`} records={attendanceRecs} year={m.year} month={m.month} />
              ))}
              <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignSelf: 'flex-end' }}>
                {[['var(--emerald-bright)', 'Present'], ['var(--red)', 'Absent'], ['var(--amber)', 'Late']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ink-pale)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2 — Academic progress ── */}
      <div className="report-section" style={{ marginBottom: 20 }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>2. Academic Progress</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Topics covered ({topics.length})
              </div>
              {topics.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--ink-pale)' }}>No topics logged.</p>
              ) : topics.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: 'var(--emerald)', fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', direction: 'rtl', color: 'var(--ink-mid)' }}>
                    {t.title_ur || t.title}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Classwork grades
              </div>
              <GradesBreakdown grades={grades} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3 — Homework ── */}
      <div className="report-section" style={{ marginBottom: 20 }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>3. Homework Performance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: hwAvg >= 80 ? 'var(--emerald)' : hwAvg >= 60 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>
                {hwAvg != null ? `${hwAvg}%` : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 2 }}>Overall average</div>
            </div>
            <div style={{ flex: 1 }}>
              <ProgressBar value={hwAvg ?? 0} variant={hwAvg >= 80 ? 'green' : hwAvg >= 60 ? 'gold' : 'red'} height={8} />
            </div>
          </div>

          {criteria.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Criterion', 'Avg marks', 'Max', 'Avg %', 'Trend'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((c, i) => {
                  const isLast = i === criteria.length - 1;
                  const avgPct = c.max_marks > 0 && c.avg_marks != null ? Math.round((c.avg_marks / c.max_marks) * 100) : null;
                  return (
                    <tr key={c.id ?? i}>
                      <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 13 }}>{c.label_ur}</td>
                      <td style={{ ...tdStyle(isLast), fontWeight: 600, color: avgPct != null ? (avgPct >= 80 ? 'var(--emerald)' : avgPct >= 60 ? 'var(--amber)' : 'var(--red)') : 'var(--ink-mid)' }}>
                        {c.avg_marks != null ? c.avg_marks.toFixed(1) : '—'}
                      </td>
                      <td style={{ ...tdStyle(isLast), color: 'var(--ink-pale)' }}>{c.max_marks}</td>
                      <td style={tdStyle(isLast)}>{avgPct != null ? `${avgPct}%` : '—'}</td>
                      <td style={tdStyle(isLast)}><TrendArrow trend={c.trend} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Section 4 — Assessments ── */}
      {assessments.length > 0 && (
        <div className="report-section" style={{ marginBottom: 20 }}>
          <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>4. Assessments</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Assessment', 'Type', 'Score / Grade', 'Topic'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessments.map((a, i) => {
                  const isLast = i === assessments.length - 1;
                  const pct    = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null;
                  return (
                    <tr key={i}>
                      <td style={tdStyle(isLast)}>{a.assessment_date}</td>
                      <td style={{ ...tdStyle(isLast), fontWeight: 500 }}>{a.title}</td>
                      <td style={tdStyle(isLast)}>
                        <span className={a.type === 'oral' ? 'chip chip-green' : a.type === 'written' ? 'chip chip-blue' : 'chip chip-gold'} style={{ fontSize: 10 }}>
                          {a.type}
                        </span>
                      </td>
                      <td style={{ ...tdStyle(isLast), fontWeight: 600, color: pct != null ? (pct >= 80 ? 'var(--emerald)' : pct >= 60 ? 'var(--amber)' : 'var(--red)') : 'var(--ink-mid)' }}>
                        {a.type === 'oral' ? (a.oral_grade ?? '—') : (
                          a.score != null ? `${a.score} / ${a.max_score}${pct != null ? ` (${pct}%)` : ''}` : '—'
                        )}
                      </td>
                      <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 12 }}>
                        {a.topic_title_ur ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 5 — Teacher remarks ── */}
      {notes.length > 0 && (
        <div className="report-section" style={{ marginBottom: 20 }}>
          <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>5. Teacher Remarks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.slice(0, 3).map((note, i) => (
                <div key={i} style={{ borderRight: '3px solid var(--emerald)', paddingRight: 16, paddingLeft: 8, direction: 'rtl' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-mid)', lineHeight: 1.7, marginBottom: 4 }}>
                    {note.note_ur}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-pale)', direction: 'ltr', textAlign: 'right' }}>
                    {note.session_date} · {note.topic_title_ur ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
