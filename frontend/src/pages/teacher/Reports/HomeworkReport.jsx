import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import MetricCard from '../../../components/MetricCard';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Button from '../../../components/Button';
import { useHomeworkReport } from '../../../hooks/useReports';
import { getClasses } from '../../../api/classes';

function defaultRange() {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

function avgColor(pct) {
  if (pct == null) return 'var(--ink-pale)';
  if (pct >= 80) return 'var(--emerald)';
  if (pct >= 60) return 'var(--amber)';
  return 'var(--red)';
}

function avgBg(pct) {
  if (pct == null) return 'var(--sand)';
  if (pct >= 80) return 'var(--emerald-light)';
  if (pct >= 60) return 'var(--gold-light)';
  return 'var(--red-light)';
}

export default function HomeworkReport() {
  const { user } = useAuth();
  const [classId,   setClassId]   = useState('');
  const [dateRange, setDateRange] = useState(defaultRange());

  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes', user?.center_id],
    queryFn:  () => getClasses({ center_id: user?.center_id }),
    staleTime: 5 * 60_000,
  });
  const classes = classesRaw?.data ?? classesRaw ?? [];

  const { data: report, isLoading } = useHomeworkReport(classId, dateRange);

  const stats    = report ?? {};
  const criteria = stats.criteria ?? [];

  const selectedClass = classes.find((c) => String(c.id) === String(classId));

  function exportCSV() {
    const header = ['Criterion', 'Max marks', 'Avg %', 'Highest', 'Lowest'];
    const rows = criteria.map((c) => [
      c.label_ur ?? '',
      c.max_marks ?? '',
      c.avg_pct   ?? '',
      c.highest   ?? '',
      c.lowest    ?? '',
    ]);
    const csv = '﻿' + [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `homework-report-${selectedClass?.name ?? 'class'}-${dateRange.from}-${dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Homework Performance Report
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {selectedClass ? selectedClass.name : 'Select a class'} — per criterion breakdown
          </p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select
            className="f-select"
            style={{ width: 200 }}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">— Select class —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            className="f-input"
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
            style={{ width: 150 }}
          />
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--ink-pale)' }}>to</span>
          <input
            className="f-input"
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
            style={{ width: 150 }}
          />
          {classId && <Button variant="outline" onClick={exportCSV}>Export CSV</Button>}
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {!classId ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: 'var(--ink-pale)' }}>
          Select a class to view the homework performance report.
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <>
          {/* Summary metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <MetricCard
              label="Sessions logged"
              value={stats.total_sessions ?? '—'}
              variant="blue"
            />
            <MetricCard
              label="Avg homework %"
              value={stats.avg_homework_pct != null ? `${stats.avg_homework_pct}%` : '—'}
              variant={stats.avg_homework_pct >= 80 ? 'green' : stats.avg_homework_pct >= 60 ? 'gold' : 'red'}
            />
            <MetricCard
              label="Top performer"
              value={stats.top_performer ?? '—'}
              variant="green"
            />
            <MetricCard
              label="Needs attention"
              value={stats.needs_revision ?? '—'}
              variant="red"
            />
          </div>

          {/* Per-criterion card grid */}
          {criteria.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--ink-pale)' }}>
              No homework criteria data for this period.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {criteria.map((c, i) => {
                const pct = c.avg_pct ?? null;
                const bottom3 = c.bottom_students ?? [];
                return (
                  <Card key={c.id ?? i} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Card header — Urdu label + max marks */}
                    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--sand)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 2 }}>
                          Max: {c.max_marks}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            direction: 'rtl',
                            color: 'var(--ink)',
                            textAlign: 'right',
                            flex: 1,
                          }}
                        >
                          {c.label_ur}
                        </span>
                      </div>
                      {c.label && (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{c.label}</div>
                      )}
                    </div>

                    <CardBody style={{ flex: 1 }}>
                      {/* Large avg % */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 72,
                          height: 72,
                          borderRadius: '50%',
                          background: avgBg(pct),
                          margin: '0 auto 14px',
                        }}
                      >
                        <span style={{ fontSize: 20, fontWeight: 700, color: avgColor(pct) }}>
                          {pct != null ? `${pct}%` : '—'}
                        </span>
                      </div>

                      {/* Highest / Lowest row */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        <div
                          style={{
                            flex: 1,
                            background: 'var(--emerald-light)',
                            borderRadius: 'var(--radius)',
                            padding: '8px 10px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 10, color: 'var(--emerald)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Highest</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--emerald)' }}>
                            {c.highest != null ? c.highest : '—'}
                          </div>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            background: c.lowest != null && c.lowest / c.max_marks < 0.6 ? 'var(--red-light)' : 'var(--sand)',
                            borderRadius: 'var(--radius)',
                            padding: '8px 10px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 10, color: c.lowest != null && c.lowest / c.max_marks < 0.6 ? 'var(--red)' : 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Lowest</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: c.lowest != null && c.lowest / c.max_marks < 0.6 ? 'var(--red)' : 'var(--ink-mid)' }}>
                            {c.lowest != null ? c.lowest : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Bottom 3 students needing attention */}
                      {bottom3.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Needs attention
                          </div>
                          {bottom3.map((s, si) => (
                            <div
                              key={s.user_id ?? si}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 0',
                                borderTop: si > 0 ? '1px solid var(--sand)' : 'none',
                              }}
                            >
                              <span style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{s.full_name}</span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: s.avg != null && s.avg / c.max_marks < 0.6 ? 'var(--red)' : 'var(--amber)',
                                }}
                              >
                                {s.avg != null ? s.avg.toFixed(1) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
