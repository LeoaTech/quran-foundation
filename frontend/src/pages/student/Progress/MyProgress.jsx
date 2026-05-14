import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import MetricCard from '../../../components/MetricCard';
import ProgressBar from '../../../components/ProgressBar';
import Badge from '../../../components/Badge';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { useStudentProgress } from '../../../hooks/useProgress';

const GRADE_CHIP = {
  excellent: { cls: 'chip chip-green', label: 'Excellent'  },
  good:      { cls: 'chip chip-blue',  label: 'Good'       },
  average:   { cls: 'chip chip-gold',  label: 'Average'    },
  revision:  { cls: 'chip chip-red',   label: 'Needs Rev.' },
};

// ── Topic progress section ────────────────────────────────────────────────────
function TopicProgressBar({ topic, sessions }) {
  const [expanded, setExpanded] = useState(false);

  // Find all sessions that touched this topic
  const topicSessions = sessions.filter((s) => s.cw_topic_id === topic.id);
  const subtopicsCovered = new Set(topicSessions.map((s) => s.cw_subtopic_id).filter(Boolean));
  const total     = topic.subtopics?.length ?? 0;
  const covered   = total > 0 ? subtopicsCovered.size : (topicSessions.length > 0 ? 1 : 0);
  const denominator = total > 0 ? total : 1;
  const pct       = Math.min(Math.round((covered / denominator) * 100), 100);
  const variant   = pct >= 80 ? 'green' : pct >= 40 ? 'gold' : 'neutral';

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: total > 0 ? 'pointer' : 'default' }}
        onClick={() => total > 0 && setExpanded((v) => !v)}
      >
        <span style={{ minWidth: 180, fontSize: 13, color: 'var(--ink-soft)' }}>
          {topic.title_ur ? (
            <span style={{ fontFamily: 'var(--font-display)', direction: 'rtl' }}>{topic.title_ur}</span>
          ) : topic.title}
        </span>
        <div style={{ flex: 1 }}>
          <ProgressBar value={pct} variant={variant} height={6} />
        </div>
        <span style={{ minWidth: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: pct >= 80 ? 'var(--emerald)' : pct >= 40 ? 'var(--amber)' : 'var(--ink-pale)' }}>
          {pct}%
        </span>
        {total > 0 && (
          <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && total > 0 && (
        <div style={{ marginTop: 6, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {topic.subtopics.map((sub) => {
            const done = subtopicsCovered.has(sub.id);
            return (
              <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, color: done ? 'var(--emerald)' : 'var(--sand-deep)' }}>
                  {done ? '✓' : '○'}
                </span>
                <span style={{ fontSize: 12, color: done ? 'var(--ink-mid)' : 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl' }}>
                  {sub.title_ur || sub.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────
function SessionRow({ session, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const chip   = GRADE_CHIP[session.cw_grade];
  const scores = session.homework_scores ?? [];
  const hwPct  = session.homework_pct ?? null;

  const tdStyle = { padding: '10px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: isLast && !expanded ? 'none' : '1px solid var(--sand)', verticalAlign: 'middle' };

  return (
    <>
      <tr
        style={{ cursor: scores.length > 0 ? 'pointer' : 'default' }}
        onClick={() => scores.length > 0 && setExpanded((v) => !v)}
        onMouseEnter={(e) => { if (scores.length > 0) e.currentTarget.querySelectorAll('td').forEach((td) => (td.style.background = 'var(--sand)')); }}
        onMouseLeave={(e) => e.currentTarget.querySelectorAll('td').forEach((td) => (td.style.background = ''))}
      >
        <td style={tdStyle}>{session.session_date}</td>
        <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>
          {session.cw_topic_title_ur || session.cw_topic_title || '—'}
        </td>
        <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 12, color: 'var(--ink-pale)' }}>
          {session.cw_subtopic_title_ur || ''}
        </td>
        <td style={tdStyle}>
          {chip ? <span className={chip.cls}>{chip.label}</span> : '—'}
        </td>
        <td style={{ ...tdStyle, fontWeight: hwPct !== null ? 600 : 400, color: hwPct !== null ? (hwPct >= 80 ? 'var(--emerald)' : hwPct >= 60 ? 'var(--amber)' : 'var(--red)') : 'var(--ink-pale)' }}>
          {hwPct !== null ? `${hwPct}%` : '—'}
        </td>
        <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 12, color: 'var(--ink-soft)', maxWidth: 200 }}>
          {session.cw_note_ur ?? ''}
        </td>
      </tr>

      {expanded && scores.length > 0 && (
        <tr>
          <td colSpan={6} style={{ padding: '0 14px 12px', borderBottom: isLast ? 'none' : '1px solid var(--sand)', background: 'var(--sand)' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 8 }}>
              {scores.map((sc) => (
                <div key={sc.id} style={{ fontSize: 12 }}>
                  <div style={{ fontFamily: 'var(--font-display)', direction: 'rtl', color: 'var(--ink-soft)', marginBottom: 2 }}>
                    {sc.label_ur || sc.label}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    {sc.marks_obtained} / {sc.max_marks}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MyProgress() {
  const { user } = useAuth();
  const from = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to   = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useStudentProgress(user?.id, {
    from,
    to,
    include: 'homework_scores',
  });

  const summary  = data ?? {};
  const sessions = summary.sessions ?? summary.data?.sessions ?? [];
  const topics   = summary.topics_covered ?? summary.data?.topics_covered ?? [];

  const topicsCoveredCount = topics.length;
  const attendancePct      = summary.attendance_pct ?? null;
  const hwAvg              = summary.homework_avg_pct ?? null;

  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          My Progress
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Year to date</p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Topics covered" value={topicsCoveredCount}                                                         variant="green"  />
        <MetricCard label="Attendance"     value={attendancePct != null ? `${attendancePct}%` : '—'} sub="Year to date"       variant="blue"   />
        <MetricCard label="Homework avg."  value={hwAvg != null ? `${hwAvg}%` : '—'}                sub="Across all sessions" variant={hwAvg != null ? (hwAvg >= 80 ? 'green' : hwAvg >= 60 ? 'gold' : 'red') : 'neutral'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Topic progress */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>
            Topic progress
          </div>
          {topics.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-pale)', textAlign: 'center', padding: '20px 0' }}>No topics logged yet.</p>
          ) : (
            topics.map((t) => (
              <TopicProgressBar key={t.id} topic={t} sessions={sessions} />
            ))
          )}
        </div>

        {/* Session history */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sand-mid)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Session history ({sessions.length})
          </div>
          {sessions.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-pale)' }}>No sessions recorded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    {['Date', 'Topic', 'Subtopic', 'Grade', 'HW %', 'Teacher note'].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <SessionRow key={s.id ?? s.session_id ?? i} session={s} isLast={i === sessions.length - 1} />
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
