import { useAuth } from '../../hooks/useAuth';
import { useCenterReport } from '../../hooks/useReports';
import MetricCard from '../../components/MetricCard';
import LoadingSpinner from '../../components/LoadingSpinner';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { data: report, isLoading } = useCenterReport(user?.center_id, currentMonth());
  const s = report ?? {};

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>{new Date().toLocaleString('en', { month: 'long', year: 'numeric' })}</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <div className="metrics-grid cols-4">
          <MetricCard
            label="Students"
            value={s.active_students ?? '—'}
            variant="green"
          />
          <MetricCard
            label="Active classes"
            value={s.active_classes ?? '—'}
            variant="blue"
          />
          <MetricCard
            label="Attendance"
            value={s.attendance_pct != null ? `${s.attendance_pct}%` : '—'}
            variant={s.attendance_pct >= 75 ? 'green' : s.attendance_pct >= 60 ? 'gold' : 'red'}
          />
          <MetricCard
            label="New enrollments"
            value={s.new_enrollments ?? '—'}
            variant="neutral"
          />
        </div>
      )}
    </>
  );
}
