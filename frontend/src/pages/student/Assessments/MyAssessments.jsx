import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { getStudentAssessments } from '../../../api/assessments';

const TYPE_CHIP = {
  written:    { label: 'Written',    cls: 'chip chip-blue'  },
  oral:       { label: 'Oral',       cls: 'chip chip-green' },
  topic_test: { label: 'Topic test', cls: 'chip chip-gold'  },
};

const ORAL_CHIP = {
  excellent: 'chip chip-green',
  good:      'chip chip-blue',
  average:   'chip chip-gold',
  fail:      'chip chip-red',
};

export default function MyAssessments() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['student-assessments', user?.id],
    queryFn:  () => getStudentAssessments(user?.id),
    staleTime: 2 * 60_000,
    enabled:  !!user?.id,
  });

  const assessments = data?.data ?? data ?? [];

  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' };
  const tdStyle = (last) => ({ padding: '10px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: last ? 'none' : '1px solid var(--sand)', verticalAlign: 'middle' });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          My Assessments
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {assessments.length} result{assessments.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {assessments.length === 0 ? (
        <EmptyState icon="▦" title="No assessments yet" description="Your assessment results will appear here once recorded by your teacher." />
      ) : (
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Assessment', 'Type', 'Score / Grade', 'Topic', 'Remarks'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...assessments]
                .sort((a, b) => (b.assessment_date ?? '').localeCompare(a.assessment_date ?? ''))
                .map((a, i, arr) => {
                  const isLast = i === arr.length - 1;
                  const chip   = TYPE_CHIP[a.type] ?? { label: a.type, cls: 'chip chip-sand' };
                  const max    = a.max_score;
                  const score  = a.score;
                  const pct    = score != null && max ? Math.round((score / max) * 100) : null;

                  return (
                    <tr key={a.result_id ?? a.id ?? i}>
                      <td style={tdStyle(isLast)}>
                        <span style={{ fontSize: 12 }}>{a.assessment_date ?? '—'}</span>
                      </td>
                      <td style={{ ...tdStyle(isLast), fontWeight: 500, color: 'var(--ink)' }}>
                        {a.title}
                        {a.title_ur && (
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', color: 'var(--ink-pale)', fontWeight: 400 }}>
                            {a.title_ur}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle(isLast)}>
                        <span className={chip.cls}>{chip.label}</span>
                      </td>
                      <td style={tdStyle(isLast)}>
                        {a.type === 'oral' ? (
                          a.oral_grade ? (
                            <span className={ORAL_CHIP[a.oral_grade] ?? 'chip chip-sand'} style={{ textTransform: 'capitalize' }}>
                              {a.oral_grade}
                            </span>
                          ) : '—'
                        ) : (
                          score != null ? (
                            <span>
                              <strong style={{ color: pct != null ? (pct >= 80 ? 'var(--emerald)' : pct >= 60 ? 'var(--amber)' : 'var(--red)') : 'var(--ink)' }}>
                                {score}
                              </strong>
                              {max && <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}> / {max}</span>}
                              {pct != null && <span style={{ fontSize: 11, color: 'var(--ink-pale)', marginLeft: 4 }}>({pct}%)</span>}
                            </span>
                          ) : '—'
                        )}
                      </td>
                      <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 12, color: 'var(--ink-soft)' }}>
                        {a.topic_title_ur ?? a.topic_title ?? '—'}
                      </td>
                      <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 12, color: 'var(--ink-soft)', maxWidth: 200 }}>
                        {a.remarks_ur ?? ''}
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
