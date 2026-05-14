import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Can from '../../../components/Can';
import MetricCard from '../../../components/MetricCard';
import ProgressBar from '../../../components/ProgressBar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import { useCenterReport } from '../../../hooks/useReports';
import { getCenters, getCenter } from '../../../api/centers';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function avgColor(pct) {
  if (pct == null) return 'var(--ink-pale)';
  if (pct >= 80) return 'var(--emerald)';
  if (pct >= 60) return 'var(--amber)';
  return 'var(--red)';
}

function exportCSV(report, centerName, month) {
  const classes = report.classes ?? [];
  const header = ['Class', 'Teacher', 'Students', 'Avg attendance %', 'Avg homework %', 'Topics covered'];
  const rows = classes.map((c) => [
    c.name ?? '',
    c.primary_teacher ?? '',
    c.student_count ?? '',
    c.avg_attendance_pct ?? '',
    c.avg_homework_pct ?? '',
    c.topics_covered ?? '',
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${centerName}-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CenterReport() {
  const { user, role } = useAuth();
  const [month, setMonth]     = useState(currentMonth());
  const [centerId, setCenterId] = useState(user?.center_id ?? '');

  const { data: centersRaw = [] } = useQuery({
    queryKey: ['centers'],
    queryFn:  getCenters,
    staleTime: 5 * 60_000,
    enabled: role === 'super_admin',
  });
  const centers = centersRaw?.data ?? centersRaw ?? [];

  const { data: centerData } = useQuery({
    queryKey: ['center', centerId],
    queryFn:  () => getCenter(centerId),
    staleTime: 10 * 60_000,
    enabled:  !!centerId,
  });

  const { data: report, isLoading } = useCenterReport(centerId, month);

  const centerName = centerData?.name ?? 'Center';
  const stats      = report ?? {};
  const classes    = stats.classes ?? [];
  const criteria   = stats.homework_criteria ?? [];

  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' };
  const tdStyle = (last) => ({ padding: '10px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: last ? 'none' : '1px solid var(--sand)', verticalAlign: 'middle' });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            {centerName} — Monthly Report
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{month}</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10 }}>
          {role === 'super_admin' && (
            <select className="f-select" style={{ width: 180 }} value={centerId} onChange={(e) => setCenterId(e.target.value)}>
              <option value="">— Select center —</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input className="f-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160 }} />
          <Can permission="reports.export">
            <Button variant="outline" onClick={() => exportCSV(stats, centerName, month)}>Export CSV</Button>
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
          </Can>
        </div>
      </div>

      {!centerId ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--ink-pale)' }}>Select a center to view the report.</div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>
      ) : (
        <>
          {/* Section 1 — Overview metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <MetricCard label="Students"            value={stats.active_students    ?? '—'} variant="green"   />
            <MetricCard label="Active classes"      value={stats.active_classes     ?? '—'} variant="blue"    />
            <MetricCard label="Attendance"          value={stats.attendance_pct != null ? `${stats.attendance_pct}%` : '—'} variant={stats.attendance_pct >= 75 ? 'green' : stats.attendance_pct >= 60 ? 'gold' : 'red'} />
            <MetricCard label="New enrollments"     value={stats.new_enrollments    ?? '—'} variant="neutral" />
          </div>

          {/* Section 2 — Class breakdown */}
          <div className="report-section" style={{ marginBottom: 24 }}>
            <Card>
              <CardHeader><span className="card-title">Class breakdown</span></CardHeader>
              <CardBody style={{ padding: 0 }}>
                {classes.length === 0 ? (
                  <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--ink-pale)' }}>No class data for this month.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Class', 'Teacher', 'Students', 'Avg attendance', 'Avg HW %', 'Topics'].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((c, i) => {
                        const isLast = i === classes.length - 1;
                        return (
                          <tr key={c.id ?? i}>
                            <td style={{ ...tdStyle(isLast), fontWeight: 600, color: 'var(--ink)' }}>{c.name}</td>
                            <td style={tdStyle(isLast)}>{c.primary_teacher ?? '—'}</td>
                            <td style={tdStyle(isLast)}>{c.student_count ?? '—'}</td>
                            <td style={{ ...tdStyle(isLast), width: 120 }}>
                              {c.avg_attendance_pct != null ? (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: avgColor(c.avg_attendance_pct), marginBottom: 3 }}>{c.avg_attendance_pct}%</div>
                                  <ProgressBar value={c.avg_attendance_pct} variant={c.avg_attendance_pct >= 75 ? 'green' : c.avg_attendance_pct >= 60 ? 'gold' : 'red'} height={4} />
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ ...tdStyle(isLast), width: 110 }}>
                              {c.avg_homework_pct != null ? (
                                <span style={{ fontWeight: 600, color: avgColor(c.avg_homework_pct) }}>{c.avg_homework_pct}%</span>
                              ) : '—'}
                            </td>
                            <td style={tdStyle(isLast)}>{c.topics_covered ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Section 3 — Homework criteria breakdown */}
          {criteria.length > 0 && (
            <div className="report-section">
              <Card>
                <CardHeader><span className="card-title">Homework performance by criterion</span></CardHeader>
                <CardBody style={{ padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Criterion (Urdu)', 'Class', 'Max', 'Class avg', 'Highest', 'Lowest'].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((c, i) => {
                        const isLast = i === criteria.length - 1;
                        const avgPct = c.max_marks > 0 && c.class_avg != null ? Math.round((c.class_avg / c.max_marks) * 100) : null;
                        return (
                          <tr key={c.id ?? i}>
                            <td style={{ ...tdStyle(isLast), fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 14 }}>{c.label_ur}</td>
                            <td style={tdStyle(isLast)}>{c.class_name ?? '—'}</td>
                            <td style={tdStyle(isLast)}>{c.max_marks}</td>
                            <td style={{ ...tdStyle(isLast), fontWeight: 600, color: avgColor(avgPct) }}>
                              {c.class_avg != null ? c.class_avg.toFixed(1) : '—'}
                              {avgPct != null && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-pale)', marginLeft: 4 }}>({avgPct}%)</span>}
                            </td>
                            <td style={{ ...tdStyle(isLast), color: 'var(--emerald)', fontWeight: 500 }}>{c.highest ?? '—'}</td>
                            <td style={{ ...tdStyle(isLast), color: c.lowest != null && c.lowest / c.max_marks < 0.6 ? 'var(--red)' : 'var(--ink-mid)', fontWeight: 500 }}>{c.lowest ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
