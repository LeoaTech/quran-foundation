import { useQuery } from '@tanstack/react-query';
import client from '../../api/client';

export default function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ['report', 'org'],
    queryFn: () => client.get('/reports/org/overview').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const d = data ?? {};

  return (
    <>
      <div className="page-header">
        <h2>Overview</h2>
        <p>All centers — {new Date().toLocaleString('en', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="metrics-grid cols-4">
        <div className="metric-card green">
          <div className="metric-label">Total students</div>
          <div className="metric-value green">{d.total_students ?? '—'}</div>
          <div className="metric-sub">Active enrollments</div>
        </div>
        <div className="metric-card blue">
          <div className="metric-label">Active centers</div>
          <div className="metric-value blue">{d.active_centers ?? '—'}</div>
          <div className="metric-sub">All operational</div>
        </div>
        <div className="metric-card neutral">
          <div className="metric-label">Teachers</div>
          <div className="metric-value neutral">{d.total_teachers ?? '—'}</div>
          <div className="metric-sub">Across all centers</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Avg. attendance</div>
          <div className="metric-value gold">{d.attendance_pct != null ? `${d.attendance_pct}%` : '—'}</div>
          <div className="metric-sub">Overall rate</div>
        </div>
      </div>
    </>
  );
}
