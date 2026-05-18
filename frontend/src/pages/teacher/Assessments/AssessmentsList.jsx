import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import Badge from '../../../components/Badge';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import CreateAssessmentModal from './CreateAssessmentModal';
import { getClasses } from '../../../api/classes';
import { getClassAssessments } from '../../../api/assessments';

const TYPE_CHIP = {
  written:    { label: 'Written',    cls: 'chip chip-blue'  },
  oral:       { label: 'Oral',       cls: 'chip chip-green' },
  topic_test: { label: 'Topic test', cls: 'chip chip-gold'  },
};

function thStyle() {
  return { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)' };
}
function tdStyle(last) {
  return { padding: '11px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: last ? 'none' : '1px solid var(--sand)', verticalAlign: 'middle' };
}

export default function AssessmentsList() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const centerId   = user?.center_id;

  const [classId,  setClassId]  = useState('');
  const [typeFilter, setType]   = useState('');
  const [addOpen,  setAddOpen]  = useState(false);

  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes', centerId],
    queryFn:  () => getClasses(centerId, { is_active: true }),
    staleTime: 5 * 60_000,
    enabled:  !!centerId,
  });
  const classes = classesRaw?.data ?? classesRaw ?? [];

  const { data: assessmentsRaw = [], isLoading } = useQuery({
    queryKey:  ['class-assessments', classId],
    queryFn:   () => getClassAssessments(classId),
    staleTime: 2 * 60_000,
    enabled:   !!classId,
  });
  const allAssessments = assessmentsRaw?.data ?? assessmentsRaw ?? [];

  const assessments = typeFilter
    ? allAssessments.filter((a) => a.type === typeFilter)
    : allAssessments;

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Assessments
          </h2>
          {selectedClass && (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {selectedClass.name} · {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Can permission="assessments.create">
          <Button variant="primary" disabled={!classId} onClick={() => setAddOpen(true)}>
            + Create assessment
          </Button>
        </Can>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
            { label: 'All',    value: ''          },
            { label: 'Written',    value: 'written'    },
            { label: 'Oral',       value: 'oral'       },
            { label: 'Topic test', value: 'topic_test' },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setType(value)}
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, background: typeFilter === value ? 'var(--emerald-light)' : 'white', color: typeFilter === value ? 'var(--emerald)' : 'var(--ink-soft)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!classId ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--ink-pale)' }}>
          Select a class to view assessments.
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : assessments.length === 0 ? (
        <EmptyState
          icon="▦"
          title="No assessments yet"
          description="Create the first assessment for this class."
          action={<Button variant="primary" onClick={() => setAddOpen(true)}>+ Create assessment</Button>}
        />
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Title', 'Title (Urdu)', 'Type', 'Date', 'Max score', 'Results', ''].map((h) => (
                  <th key={h} style={thStyle()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assessments.map((a, i) => {
                const chip       = TYPE_CHIP[a.type] ?? { label: a.type, cls: 'chip chip-sand' };
                const resultCount = a.result_count ?? a.results_recorded ?? null;
                const total       = a.total_students ?? null;
                const isLast      = i === assessments.length - 1;
                return (
                  <tr
                    key={a.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/assessments/${a.id}`)}
                    onMouseEnter={(e) => e.currentTarget.querySelectorAll('td').forEach((td) => (td.style.background = 'var(--sand)'))}
                    onMouseLeave={(e) => e.currentTarget.querySelectorAll('td').forEach((td) => (td.style.background = ''))}
                  >
                    <td style={{ ...tdStyle(isLast), fontWeight: 600, color: 'var(--ink)' }}>{a.title}</td>
                    <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 13 }}>{a.title_ur ?? ''}</td>
                    <td style={tdStyle(isLast)}><span className={chip.cls}>{chip.label}</span></td>
                    <td style={tdStyle(isLast)}><span style={{ fontSize: 12 }}>{a.assessment_date}</span></td>
                    <td style={{ ...tdStyle(isLast), fontWeight: a.max_score ? 500 : 400, color: a.max_score ? 'var(--ink)' : 'var(--ink-pale)' }}>
                      {a.type === 'oral' ? '—' : (a.max_score ?? '—')}
                    </td>
                    <td style={tdStyle(isLast)}>
                      {resultCount !== null && total !== null ? (
                        <span style={{ fontSize: 12, color: resultCount === total ? 'var(--emerald)' : 'var(--ink-soft)' }}>
                          {resultCount}/{total} recorded
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-pale)' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle(isLast)} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/assessments/${a.id}`)}>
                        Enter results →
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateAssessmentModal
        open={addOpen}
        classId={classId}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => id && navigate(`/assessments/${id}`)}
      />
    </>
  );
}
