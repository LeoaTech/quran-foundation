import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import MetricCard from '../../../components/MetricCard';
import { useToast } from '../../../hooks/useToast';
import { getAssessment, submitResults, getAssessmentResults } from '../../../api/assessments';
import { getClassEnrollments } from '../../../api/classes';
import { getTopics } from '../../../api/courses';

const TYPE_CHIP = {
  written:    { label: 'Written',    cls: 'chip chip-blue'  },
  oral:       { label: 'Oral',       cls: 'chip chip-green' },
  topic_test: { label: 'Topic test', cls: 'chip chip-gold'  },
};

const ORAL_GRADES = ['excellent', 'good', 'average', 'fail'];

const ORAL_STYLE = {
  excellent: { bg: 'var(--emerald)', color: 'white' },
  good:      { bg: 'var(--blue)',    color: 'white' },
  average:   { bg: 'var(--amber)',   color: 'white' },
  fail:      { bg: 'var(--red)',     color: 'white' },
};

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1.5px solid var(--sand-mid)', marginBottom: 24 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{ padding: '10px 20px 12px', fontSize: 14, fontWeight: 500, color: active === t.id ? 'var(--emerald)' : 'var(--ink-pale)', borderBottom: active === t.id ? '2.5px solid var(--emerald)' : '2.5px solid transparent', marginBottom: -1.5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 0.2s' }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Enter Results tab ─────────────────────────────────────────────────────────
function EnterResultsTab({ assessment }) {
  const toast = useToast();
  const qc    = useQueryClient();
  const isOral = assessment.type === 'oral';

  const { data: enrollmentsRaw = [] } = useQuery({
    queryKey: ['class-enrollments', assessment.class_id, 'active'],
    queryFn:  () => getClassEnrollments(assessment.class_id, { status: 'active' }),
    staleTime: 2 * 60_000,
  });

  const { data: existingRaw = [] } = useQuery({
    queryKey: ['assessment-results', assessment.id],
    queryFn:  () => getAssessmentResults(assessment.id),
    staleTime: 30_000,
  });

  const { data: topicsRaw = [] } = useQuery({
    queryKey: ['topics', assessment.course_id],
    queryFn:  () => getTopics(assessment.course_id),
    staleTime: 5 * 60_000,
    enabled:  !!assessment.course_id,
  });

  const students  = enrollmentsRaw?.data ?? enrollmentsRaw ?? [];
  const existing  = existingRaw?.data    ?? existingRaw    ?? [];
  const topics    = topicsRaw?.data      ?? topicsRaw      ?? [];

  // Build initial entry state from existing results
  const [entries, setEntries] = useState(() => {
    const map = {};
    existing.forEach((r) => {
      map[r.student_user_id] = {
        score:           r.score          ?? '',
        oral_grade:      r.oral_grade     ?? '',
        topic_tested_id: r.topic_tested_id ?? '',
        remarks_ur:      r.remarks_ur     ?? '',
        result_id:       r.id,
        saved:           true,
      };
    });
    return map;
  });

  const [busy, setBusy] = useState(false);

  function setEntry(studentId, field, value) {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [field]: value, saved: false },
    }));
  }

  async function handleSave() {
    setBusy(true);
    try {
      const results = students.map((s) => {
        const id  = s.student_user_id ?? s.id;
        const e   = entries[id] ?? {};
        return {
          student_user_id: id,
          score:           isOral ? null : (e.score !== '' ? Number(e.score) : null),
          oral_grade:      isOral ? (e.oral_grade || null) : null,
          topic_tested_id: e.topic_tested_id || undefined,
          remarks_ur:      e.remarks_ur      || undefined,
        };
      }).filter((r) => r.score !== null || r.oral_grade !== null);

      await submitResults(assessment.id, results);
      await qc.invalidateQueries({ queryKey: ['assessment-results', assessment.id] });
      // Mark all as saved
      setEntries((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { next[k] = { ...next[k], saved: true }; });
        return next;
      });
      toast.success('Results saved.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save results.');
    } finally {
      setBusy(false);
    }
  }

  if (students.length === 0) {
    return <EmptyState icon="○" title="No enrolled students" description="This class has no active enrollments." />;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {students.length} student{students.length !== 1 ? 's' : ''}
          {assessment.type !== 'oral' && ` · Max: ${assessment.max_score}`}
        </span>
        <Button variant="primary" disabled={busy} onClick={handleSave}>
          {busy ? 'Saving…' : 'Save all results'}
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {students.map((s) => {
          const id   = s.student_user_id ?? s.id;
          const e    = entries[id] ?? {};
          const saved = e.saved;

          return (
            <div key={id} style={{ background: 'var(--white)', border: `1px solid ${saved ? 'var(--sand-mid)' : 'var(--sand-deep)'}`, borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Student name */}
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.full_name ?? '—'}
                  {saved && <span style={{ color: 'var(--emerald)', fontSize: 14 }}>✓</span>}
                </div>
                {s.full_name_ur && (
                  <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>{s.full_name_ur}</div>
                )}
              </div>

              {/* Score or oral grade */}
              {isOral ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  {ORAL_GRADES.map((g) => {
                    const active = e.oral_grade === g;
                    const st     = ORAL_STYLE[g];
                    return (
                      <button
                        key={g}
                        onClick={() => setEntry(id, 'oral_grade', g)}
                        style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: active ? 'none' : '1.5px solid var(--sand-deep)', background: active ? st.bg : 'white', color: active ? st.color : 'var(--ink-soft)', fontWeight: active ? 700 : 500, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'var(--font-body)' }}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="f-input"
                    type="number"
                    min={0}
                    max={assessment.max_score}
                    value={e.score ?? ''}
                    onChange={(ev) => setEntry(id, 'score', ev.target.value)}
                    style={{ width: 72, textAlign: 'center' }}
                    placeholder="0"
                  />
                  <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>/ {assessment.max_score}</span>
                </div>
              )}

              {/* Topic tested */}
              {topics.length > 0 && (
                <select
                  className="f-select"
                  style={{ width: 180, fontSize: 12 }}
                  value={e.topic_tested_id ?? ''}
                  onChange={(ev) => setEntry(id, 'topic_tested_id', ev.target.value)}
                >
                  <option value="">— Topic tested —</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.title_ur ? `${t.title_ur} / ${t.title}` : t.title}</option>
                  ))}
                </select>
              )}

              {/* Remarks Urdu */}
              <div style={{ flex: 1, minWidth: 150 }}>
                <RTLInput
                  placeholder="نوٹ (اختیاری)"
                  value={e.remarks_ur ?? ''}
                  onChange={(ev) => setEntry(id, 'remarks_ur', ev.target.value)}
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="primary" disabled={busy} onClick={handleSave}>
          {busy ? 'Saving…' : 'Save all results'}
        </Button>
      </div>
    </>
  );
}

// ── Results Overview tab ──────────────────────────────────────────────────────
function ResultsOverviewTab({ assessment }) {
  const { data: resultsRaw = [] } = useQuery({
    queryKey: ['assessment-results', assessment.id],
    queryFn:  () => getAssessmentResults(assessment.id),
    staleTime: 30_000,
  });

  const results = [...(resultsRaw?.data ?? resultsRaw ?? [])];
  const isOral  = assessment.type === 'oral';

  // Sort by score descending
  results.sort((a, b) => {
    if (isOral) return (a.oral_grade ?? '').localeCompare(b.oral_grade ?? '');
    return (b.score ?? 0) - (a.score ?? 0);
  });

  const max = assessment.max_score ?? 0;

  // Summary stats (written only)
  const { avg, highest, lowest, above60 } = useMemo(() => {
    if (isOral || results.length === 0) return {};
    const scores = results.map((r) => r.score ?? 0);
    const avg    = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const pct60  = max > 0 ? Math.round(max * 0.6) : 0;
    return {
      avg,
      highest: Math.max(...scores),
      lowest:  Math.min(...scores),
      above60: scores.filter((s) => s >= pct60).length,
    };
  }, [results, isOral, max]);

  function exportCSV() {
    const header = ['Student', 'Urdu Name', isOral ? 'Grade' : 'Score', isOral ? '' : `/ ${max}`, 'Topic tested', 'Remarks'];
    const rows = results.map((r) => [
      r.full_name ?? '',
      r.full_name_ur ?? '',
      isOral ? (r.oral_grade ?? '') : (r.score ?? ''),
      isOral ? '' : max,
      r.topic_title_ur ?? r.topic_title ?? '',
      r.remarks_ur ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `assessment-${assessment.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' };
  const tdStyle = (last) => ({ padding: '10px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: last ? 'none' : '1px solid var(--sand)', verticalAlign: 'middle' });

  return (
    <>
      {!isOral && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <MetricCard label="Avg. score"   value={avg ?? '—'}                    variant="blue"    />
          <MetricCard label="Highest"      value={highest ?? '—'}                variant="green"   />
          <MetricCard label="Lowest"       value={lowest ?? '—'}                 variant="neutral" />
          <MetricCard label="Above 60%"    value={above60 != null ? `${above60} / ${results.length}` : '—'} variant="gold" />
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState icon="▦" title="No results entered yet" description='Switch to "Enter results" tab to record scores.' />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button size="sm" variant="outline" onClick={exportCSV}>Export CSV</Button>
          </div>
          <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Student', 'Urdu name', isOral ? 'Grade' : 'Score', 'Topic tested', 'Remarks'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const isLast = i === results.length - 1;
                  const pct    = !isOral && max > 0 && r.score != null ? Math.round((r.score / max) * 100) : null;
                  return (
                    <tr key={r.id ?? r.student_user_id}>
                      <td style={{ ...tdStyle(isLast), fontWeight: 500, color: 'var(--ink)' }}>{r.full_name ?? '—'}</td>
                      <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>{r.full_name_ur ?? ''}</td>
                      <td style={tdStyle(isLast)}>
                        {isOral ? (
                          <span className={r.oral_grade === 'excellent' ? 'chip chip-green' : r.oral_grade === 'good' ? 'chip chip-blue' : r.oral_grade === 'average' ? 'chip chip-gold' : 'chip chip-red'} style={{ textTransform: 'capitalize' }}>
                            {r.oral_grade ?? '—'}
                          </span>
                        ) : (
                          <span>
                            <strong style={{ color: pct != null ? (pct >= 80 ? 'var(--emerald)' : pct >= 60 ? 'var(--amber)' : 'var(--red)') : 'var(--ink)' }}>
                              {r.score ?? '—'}
                            </strong>
                            {max > 0 && <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}> / {max}</span>}
                            {pct != null && <span style={{ fontSize: 11, color: 'var(--ink-pale)', marginLeft: 6 }}>({pct}%)</span>}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle(isLast), fontSize: 12, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', color: 'var(--ink-soft)' }}>
                        {r.topic_title_ur ?? r.topic_title ?? '—'}
                      </td>
                      <td style={{ ...tdStyle(isLast), fontSize: 12, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', color: 'var(--ink-soft)', maxWidth: 200 }}>
                        {r.remarks_ur ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'enter',    label: 'Enter results'    },
  { id: 'overview', label: 'Results overview' },
];

export default function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('enter');

  const { data: assessment, isLoading, error } = useQuery({
    queryKey:  ['assessment', id],
    queryFn:   () => getAssessment(id),
    staleTime: 2 * 60_000,
  });

  const chip = assessment ? (TYPE_CHIP[assessment.type] ?? { label: assessment.type, cls: 'chip chip-sand' }) : null;

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  if (error || !assessment) {
    return <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>Assessment not found.</div>;
  }

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/teacher/assessments')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 13, padding: 0, marginBottom: 10 }}
        >
          ← Assessments
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2 }}>
                {assessment.title}
              </h2>
              <span className={chip.cls}>{chip.label}</span>
            </div>
            {assessment.title_ur && (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 4 }}>
                {assessment.title_ur}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--ink-pale)', display: 'flex', gap: 12 }}>
              <span>{assessment.assessment_date}</span>
              {assessment.max_score && <span>Max: {assessment.max_score}</span>}
              {assessment.class_name && <span>{assessment.class_name}</span>}
            </div>
          </div>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'enter'    && <EnterResultsTab    assessment={assessment} />}
      {tab === 'overview' && <ResultsOverviewTab assessment={assessment} />}
    </>
  );
}
