import { useState } from 'react';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import MetricCard from '../../../components/MetricCard';
import ProgressBar from '../../../components/ProgressBar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import { useOrgReport } from '../../../hooks/useReports';
import { getCenters } from '../../../api/centers';
import { getCenterOverview } from '../../../api/reports';
import { useQuery, useQueries } from '@tanstack/react-query';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function last6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function attendanceColor(pct) {
  if (pct == null) return 'var(--ink-pale)';
  if (pct >= 75) return 'var(--emerald)';
  if (pct >= 60) return 'var(--amber)';
  return 'var(--red)';
}

function attendanceBg(pct) {
  if (pct == null) return 'transparent';
  if (pct >= 75) return 'var(--emerald-light)';
  if (pct >= 60) return 'var(--gold-light)';
  return 'var(--red-light)';
}

export default function OrgReport() {
  const [month, setMonth] = useState(currentMonth());

  const { data: overview, isLoading } = useOrgReport();

  const { data: centersRaw = [] } = useQuery({
    queryKey: ['centers'],
    queryFn:  getCenters,
    staleTime: 5 * 60_000,
  });
  const centers = centersRaw?.data ?? centersRaw ?? [];

  const months6 = last6Months();

  // Per-center per-month attendance for trend grid (parallel)
  const trendQueries = useQueries({
    queries: centers.flatMap((c) =>
      months6.map((m) => ({
        queryKey:  ['report-center', c.id, m],
        queryFn:   () => getCenterOverview(c.id, m),
        staleTime: 5 * 60_000,
      }))
    ),
  });

  function getTrend(centerIdx, monthIdx) {
    const qi = centerIdx * months6.length + monthIdx;
    return trendQueries[qi]?.data?.attendance_pct ?? null;
  }

  const stats = overview ?? {};
  const courses = stats.enrollments_by_course ?? [];
  const maxEnrollment = Math.max(...courses.map((c) => c.count ?? 0), 1);

  // Sort centers by attendance for the ranking table
  const centerOverviews = useQueries({
    queries: centers.map((c) => ({
      queryKey:  ['report-center', c.id, month],
      queryFn:   () => getCenterOverview(c.id, month),
      staleTime: 5 * 60_000,
    })),
  });

  const centersWithAtt = centers.map((c, i) => ({
    ...c,
    att: centerOverviews[i]?.data?.attendance_pct ?? null,
  })).sort((a, b) => (b.att ?? 0) - (a.att ?? 0));

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="report-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }} data-no-print="1">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Organisation Report
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Quran Foundation — all centers</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10 }}>
          <input className="f-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160 }} />
          <Button variant="outline" onClick={() => window.print()}>Print report</Button>
        </div>
      </div>

      {/* Row 1 — metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total students"   value={stats.total_students    ?? '—'} variant="green"   />
        <MetricCard label="Active centers"   value={stats.active_centers    ?? '—'} variant="blue"    />
        <MetricCard label="Avg. attendance"  value={stats.avg_attendance_pct != null ? `${stats.avg_attendance_pct}%` : '—'} variant={stats.avg_attendance_pct >= 75 ? 'green' : stats.avg_attendance_pct >= 60 ? 'gold' : 'red'} />
        <MetricCard label="Teachers"         value={stats.total_teachers    ?? '—'} variant="neutral" />
      </div>

      {/* Row 2 — enrollments by course + centers ranked */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <Card>
          <CardHeader><span className="card-title">Enrollments by course</span></CardHeader>
          <CardBody>
            {courses.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-pale)' }}>No data.</p>
            ) : courses.map((c) => {
              const pct = Math.round((c.count / maxEnrollment) * 100);
              return (
                <div key={c.course} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--ink-mid)' }}>{c.course}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.count}</span>
                  </div>
                  <ProgressBar value={pct} variant="green" height={8} />
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="card-title">Centers by attendance — {month}</span></CardHeader>
          <CardBody style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Center', 'Attendance', '%'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {centersWithAtt.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink)', borderBottom: i < centersWithAtt.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: i < centersWithAtt.length - 1 ? '1px solid var(--sand)' : 'none', width: 100 }}>
                      {c.att !== null ? <ProgressBar value={c.att} variant={c.att >= 75 ? 'green' : c.att >= 60 ? 'gold' : 'red'} height={5} /> : <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, color: attendanceColor(c.att), borderBottom: i < centersWithAtt.length - 1 ? '1px solid var(--sand)' : 'none', textAlign: 'right', width: 48 }}>
                      {c.att != null ? `${c.att}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      {/* Row 3 — Monthly trend grid */}
      <div className="report-section">
        <Card>
          <CardHeader><span className="card-title">Monthly attendance trend — last 6 months</span></CardHeader>
          <CardBody style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', padding: '6px 12px 8px', borderBottom: '1px solid var(--sand-mid)', minWidth: 140 }}>Center</th>
                  {months6.map((m) => (
                    <th key={m} style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '6px 10px 8px', borderBottom: '1px solid var(--sand-mid)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {new Date(m + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {centers.map((c, ci) => (
                  <tr key={c.id}>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--ink)', borderBottom: ci < centers.length - 1 ? '1px solid var(--sand)' : 'none' }}>{c.name}</td>
                    {months6.map((m, mi) => {
                      const pct = getTrend(ci, mi);
                      return (
                        <td key={m} style={{ padding: '8px 10px', textAlign: 'center', borderBottom: ci < centers.length - 1 ? '1px solid var(--sand)' : 'none', borderLeft: '1px solid var(--sand)' }}>
                          {pct != null ? (
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: attendanceBg(pct), color: attendanceColor(pct), fontSize: 12, fontWeight: 600 }}>
                              {pct}%
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
