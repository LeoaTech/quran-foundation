import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import Badge from '../../../components/Badge';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import WithdrawModal from './WithdrawModal';
import { getClassEnrollments } from '../../../api/enrollments';
import { getClasses } from '../../../api/classes';

const STATUS_VARIANT = {
  active:    'green',
  withdrawn: 'sand',
  transferred: 'blue',
};

function thStyle() {
  return { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)' };
}

function tdStyle(hasBorder = true) {
  return { padding: '11px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: hasBorder ? '1px solid var(--sand)' : 'none', verticalAlign: 'middle' };
}

export default function EnrollmentsList() {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const centerId = user?.center_id;

  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch]           = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState(null);

  const { data: classesRaw = [], isLoading: classesLoading } = useQuery({
    queryKey: ['classes', centerId],
    queryFn:  () => getClasses(centerId, {}),
    staleTime: 2 * 60_000,
    enabled:  !!centerId,
  });
  const classes = classesRaw?.data ?? classesRaw ?? [];

  const activeClassId = classFilter || classes[0]?.id;

  const { data: enrollmentsRaw = [], isLoading: enrollLoading } = useQuery({
    queryKey:  ['class-enrollments', activeClassId, statusFilter],
    queryFn:   () => getClassEnrollments(activeClassId, statusFilter !== 'all' ? { status: statusFilter } : {}),
    staleTime: 30_000,
    enabled:   !!activeClassId,
  });

  const allRows = enrollmentsRaw?.data ?? enrollmentsRaw ?? [];

  const rows = useMemo(() => {
    if (!search) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((en) => {
      const name   = (en.full_name    ?? en.student?.full_name    ?? '').toLowerCase();
      const nameUr = (en.full_name_ur ?? en.student?.full_name_ur ?? '').toLowerCase();
      return name.includes(q) || nameUr.includes(q);
    });
  }, [allRows, search]);

  const isLoading = classesLoading || enrollLoading;

  function handleWithdrawSuccess() {
    qc.invalidateQueries({ queryKey: ['class-enrollments', activeClassId] });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Enrollments
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {rows.length} record{rows.length !== 1 ? 's' : ''}
            {search ? ' matching search' : ''}
          </p>
        </div>
        <Can permission="enrollments.create">
          <Button variant="primary" onClick={() => navigate('/manager/enrollment')}>+ Enroll student</Button>
        </Can>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="f-select"
          style={{ width: 220 }}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--sand-deep)' }}>
          {[
            { label: 'Active',     value: 'active'    },
            { label: 'Withdrawn',  value: 'withdrawn' },
            { label: 'All',        value: 'all'       },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              style={{
                padding: '8px 14px',
                fontSize: 12, fontWeight: 500,
                background: statusFilter === value ? 'var(--emerald-light)' : 'var(--white)',
                color: statusFilter === value ? 'var(--emerald)' : 'var(--ink-soft)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          className="f-input"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200 }}
        />
      </div>

      {!centerId ? (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
          No center assigned to your account.
        </div>
      ) : classes.length === 0 && !classesLoading ? (
        <EmptyState
          icon="○"
          title="No classes found"
          description="Create a class first before enrolling students."
          action={<Button variant="outline" onClick={() => navigate('/manager/classes')}>Go to Classes</Button>}
        />
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="○"
          title="No enrollments found"
          description={search ? 'No students match your search.' : statusFilter === 'active' ? 'No active enrollments in this class.' : 'No records found.'}
          action={<Button variant="primary" onClick={() => navigate('/manager/enrollment')}>+ Enroll student</Button>}
        />
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Student', 'Urdu name', 'Class', 'Course', 'Enrolled on', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={thStyle()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((en, i) => {
                const isLast = i === rows.length - 1;
                const name   = en.full_name    ?? en.student?.full_name    ?? '—';
                const nameUr = en.full_name_ur ?? en.student?.full_name_ur ?? '';
                const clsName    = en.class_name    ?? en.class?.name    ?? '—';
                const courseName = en.course_name   ?? en.course?.name   ?? '—';
                const status     = en.status ?? 'active';

                return (
                  <tr key={en.id}>
                    <td style={tdStyle(!isLast)}>
                      <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{name}</span>
                    </td>
                    <td style={{ ...tdStyle(!isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>
                      {nameUr}
                    </td>
                    <td style={tdStyle(!isLast)}>{clsName}</td>
                    <td style={tdStyle(!isLast)}>{courseName}</td>
                    <td style={tdStyle(!isLast)}>
                      <span style={{ fontSize: 12 }}>{en.enrolled_on ?? '—'}</span>
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <Badge variant={STATUS_VARIANT[status] ?? 'sand'}>{status}</Badge>
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {status === 'active' && (
                          <Can permission="enrollments.edit">
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                              onClick={() => setWithdrawTarget(en)}
                            >
                              Withdraw
                            </Button>
                          </Can>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/students/${en.student_user_id ?? en.student?.id}`)}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WithdrawModal
        open={!!withdrawTarget}
        enrollment={withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
        onSuccess={handleWithdrawSuccess}
      />
    </>
  );
}
