import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import ProgressBar from '../../../components/ProgressBar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { getClasses, getClassEnrollments } from '../../../api/classes';
import { getStudentProgress } from '../../../api/progress';

const GRADE_VARIANT = {
  excellent: { cls: 'chip chip-green',  label: 'Excellent'  },
  good:      { cls: 'chip chip-blue',   label: 'Good'       },
  average:   { cls: 'chip chip-gold',   label: 'Average'    },
  revision:  { cls: 'chip chip-red',    label: 'Needs Rev.' },
};

function daysBefore(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ClassProgress() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const centerId   = user?.center_id;

  const [classId, setClassId] = useState('');
  const [days,    setDays]    = useState(30);

  const from = daysBefore(days);
  const to   = new Date().toISOString().slice(0, 10);

  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes', centerId],
    queryFn:  () => getClasses(centerId, { is_active: true }),
    staleTime: 5 * 60_000,
    enabled:  !!centerId,
  });
  const classes = classesRaw?.data ?? classesRaw ?? [];

  const { data: enrollmentsRaw = [], isLoading: enrollLoading } = useQuery({
    queryKey:  ['class-enrollments', classId, 'active'],
    queryFn:   () => getClassEnrollments(classId, { status: 'active' }),
    staleTime: 2 * 60_000,
    enabled:   !!classId,
  });
  const students = enrollmentsRaw?.data ?? enrollmentsRaw ?? [];

  // Per-student progress
  const progressQueries = useQueries({
    queries: students.map((s) => ({
      queryKey:  ['student-progress', s.student_user_id ?? s.id, classId, from, to],
      queryFn:   () => getStudentProgress(s.student_user_id ?? s.id, { class_id: classId, from, to }),
      staleTime: 60_000,
      enabled:   !!classId && students.length > 0,
    })),
  });

  function getStudentData(index) {
    const d = progressQueries[index]?.data;
    if (!d) return null;
    const sessions = d?.sessions ?? d?.data?.sessions ?? [];
    const last     = sessions[0];
    const hwAvg    = d?.homework_avg_pct ?? null;
    return { sessions, last, hwAvg };
  }

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Class progress
        </h2>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="f-select"
          style={{ width: 220 }}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">— Select class —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--sand-deep)' }}>
          {[
            { label: 'Last 7 days',  value: 7  },
            { label: 'Last 30 days', value: 30 },
            { label: 'Last 90 days', value: 90 },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, background: days === value ? 'var(--emerald-light)' : 'white', color: days === value ? 'var(--emerald)' : 'var(--ink-soft)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!classId ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--ink-pale)' }}>
          Select a class to see progress overview.
        </div>
      ) : enrollLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>
      ) : students.length === 0 ? (
        <EmptyState icon="○" title="No enrolled students" description="This class has no active enrollments." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {students.map((s, i) => {
            const sd     = getStudentData(i);
            const last   = sd?.last;
            const hwAvg  = sd?.hwAvg;
            const grade  = last?.cw_grade;
            const chip   = grade ? GRADE_VARIANT[grade] : null;
            const loading = progressQueries[i]?.isLoading;
            const studentId = s.student_user_id ?? s.id;

            return (
              <div key={s.id ?? studentId} style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
                {/* Name */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{s.full_name ?? '—'}</div>
                  {s.full_name_ur && (
                    <div style={{ fontSize: 12, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>{s.full_name_ur}</div>
                  )}
                </div>

                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><LoadingSpinner size={20} /></div>
                ) : last ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Last: {last.session_date}</span>
                      {chip && <span className={chip.cls} style={{ fontSize: 10 }}>{chip.label}</span>}
                    </div>
                    {last.cw_topic_title_ur && (
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', color: 'var(--ink-mid)', marginBottom: 8 }}>
                        {last.cw_topic_title_ur}
                      </div>
                    )}
                    {hwAvg !== null && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-pale)', marginBottom: 3 }}>
                          <span>Homework avg.</span>
                          <span style={{ fontWeight: 600, color: hwAvg >= 80 ? 'var(--emerald)' : hwAvg >= 60 ? 'var(--amber)' : 'var(--red)' }}>{hwAvg}%</span>
                        </div>
                        <ProgressBar value={hwAvg} variant={hwAvg >= 80 ? 'green' : hwAvg >= 60 ? 'gold' : 'red'} height={4} />
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--ink-pale)', marginBottom: 10 }}>No sessions yet.</p>
                )}

                <Button
                  size="sm"
                  variant="primary"
                  style={{ width: '100%' }}
                  onClick={() => navigate(`/progress?enrollment=${s.id ?? s.enrollment_id}&class=${classId}`)}
                >
                  Log today →
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
