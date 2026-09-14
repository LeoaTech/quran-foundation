import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useOrgReport } from '../../hooks/useReports';
import { getCenters, getCenterOverview } from '../../api/centers';
import { getDonations } from '../../api/donations';
import { getSalaryPayments } from '../../api/salaries';
import { getCenterEnrollments } from '../../api/enrollments';
import { getOrgActivity } from '../../api/activityLog';
import MetricCard from '../../components/MetricCard';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import ProgressBar from '../../components/ProgressBar';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Card, CardHeader, CardBody } from '../../components/Card';

function formatCurrency(amount) {
  if (amount == null) return '—';
  return `Rs. ${Number(amount).toLocaleString()}`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // 1. Primary Org Overview Data
  const {
    data: orgData,
    isLoading: isOrgLoading,
    isError: isOrgError,
    refetch: refetchOrg,
  } = useOrgReport();

  const d = orgData ?? {};

  // 2. Centers List
  const centersQuery = useQuery({
    queryKey: ['admin-dashboard-centers'],
    queryFn: () => getCenters({ per_page: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const rawCenters = centersQuery.data?.data ?? centersQuery.data?.centers ?? (Array.isArray(centersQuery.data) ? centersQuery.data : []);
  const centersList = Array.isArray(rawCenters) ? rawCenters : [];

  // 3. Per-Center Stats (Overview)
  const centerStatsQuery = useQuery({
    queryKey: ['admin-dashboard-center-stats', centersList.map((c) => c.id).join(',')],
    queryFn: async () => {
      if (!centersList.length) return {};
      const results = await Promise.all(
        centersList.map(async (c) => {
          try {
            const overview = await getCenterOverview(c.id);
            return { id: c.id, overview };
          } catch {
            return { id: c.id, overview: null };
          }
        })
      );
      const map = {};
      results.forEach((r) => {
        map[r.id] = r.overview;
      });
      return map;
    },
    enabled: centersList.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const centerStatsMap = centerStatsQuery.data ?? {};

  // 4. Financial Overview Data (Overall Centers: Donations, Salaries Paid, Fees Collected)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Fetch Donations
  const donationsQuery = useQuery({
    queryKey: ['admin-dashboard-donations'],
    queryFn: () => getDonations({ per_page: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const rawDonations = donationsQuery.data?.data ?? (Array.isArray(donationsQuery.data) ? donationsQuery.data : []);
  const donationsList = Array.isArray(rawDonations) ? rawDonations : [];

  const monthlyDonationsTotal = donationsList
    .filter((don) => {
      if (!don.date_received) return false;
      const dDate = new Date(don.date_received);
      return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
    })
    .reduce((sum, don) => sum + Number(don.amount || 0), 0);

  // Fetch Salaries Paid & Fees Collected per center
  const centerFinancialsQuery = useQuery({
    queryKey: ['admin-dashboard-center-financials', centersList.map((c) => c.id).join(','), currentMonth + 1, currentYear],
    queryFn: async () => {
      if (!centersList.length) return { monthlySalariesTotal: 0, monthlyFeesTotal: 0 };

      let salariesSum = 0;
      let feesSum = 0;

      await Promise.all(
        centersList.map(async (center) => {
          // Fetch salaries
          try {
            const salRes = await getSalaryPayments(center.id, { month: currentMonth + 1, year: currentYear });
            const payments = salRes?.data || [];
            payments.forEach((p) => {
              salariesSum += Number(p.amount_paid || 0);
            });
          } catch {}

          // Fetch fees from enrollments
          try {
            const enrollments = await getCenterEnrollments(center.id);
            const enrollList = Array.isArray(enrollments) ? enrollments : (enrollments?.data || []);
            enrollList.forEach((e) => {
              feesSum += Number(e.total_paid || 0);
            });
          } catch {}
        })
      );

      return { monthlySalariesTotal: salariesSum, monthlyFeesTotal: feesSum };
    },
    enabled: centersList.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const monthlySalariesTotal = centerFinancialsQuery.data?.monthlySalariesTotal ?? 0;
  const monthlyFeesTotal = centerFinancialsQuery.data?.monthlyFeesTotal ?? 0;

  // 5. Recent Activity Logs
  const activityQuery = useQuery({
    queryKey: ['admin-dashboard-activity'],
    queryFn: () => getOrgActivity({ limit: 6 }),
    staleTime: 2 * 60 * 1000,
  });

  const rawActivity = activityQuery.data?.data ?? (Array.isArray(activityQuery.data) ? activityQuery.data : []);
  const activityList = Array.isArray(rawActivity) ? rawActivity : [];

  // Prepare Center Performance Table Rows
  const centerRows = centersList.map((center) => {
    const overview = centerStatsMap[center.id] || {};
    return {
      id: center.id,
      name: center.name,
      city: center.city,
      students: overview.active_students ?? center.total_students ?? 0,
      teachers: overview.active_teachers ?? center.total_teachers ?? 0,
      attendance_pct: overview.attendance_pct ?? null,
      is_active: center.is_active ?? true,
    };
  });

  const centerTableColumns = [
    {
      key: 'name',
      label: 'CENTER NAME',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{val}</div>
          {row.city && <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{row.city}</div>}
        </div>
      ),
    },
    {
      key: 'students_teachers',
      label: 'TOTAL STUDENTS & TEACHERS',
      render: (_, row) => (
        <div style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>{row.students}</span> Students
          <span style={{ color: 'var(--ink-pale)', margin: '0 6px' }}>•</span>
          <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{row.teachers}</span> Teachers
        </div>
      ),
    },
    {
      key: 'attendance_pct',
      label: 'CENTER ATTENDANCE %',
      render: (val) => {
        if (val == null) return <span style={{ color: 'var(--ink-pale)', fontSize: 12 }}>N/A</span>;
        const pct = Math.round(val);
        const variant = pct >= 75 ? 'green' : pct >= 60 ? 'gold' : 'red';
        return (
          <div style={{ minWidth: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
              <span>{pct}%</span>
            </div>
            <ProgressBar value={pct} variant={variant} height={6} />
          </div>
        );
      },
    },
    {
      key: 'is_active',
      label: 'STATUS',
      render: (val) => (
        <Badge variant={val ? 'green' : 'red'}>
          {val ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'action',
      label: 'ACTION',
      render: (_, row) => (
        <Link
          to={`/admin/centers/${row.id}`}
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
        >
          Manage Center
        </Link>
      ),
    },
  ];

  // Top Performing Courses Data (Fixed mapping for API fields `course`, `course_ur`, `count`)
  const courseEnrollments = Array.isArray(d.enrollments_by_course) ? d.enrollments_by_course : [];
  const sortedCourses = [...courseEnrollments]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 4);

  const maxEnrollment = Math.max(...sortedCourses.map((c) => c.count || 0), 1);
  const courseVariantColors = ['green', 'blue', 'gold', 'neutral'];

  if (isOrgLoading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (isOrgError) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center', marginTop: 24 }}>
        <h3 style={{ color: 'var(--red)', marginBottom: 8 }}>Failed to load dashboard data</h3>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>
          Could not fetch organization overview report.
        </p>
        <button className="btn btn-primary" onClick={() => refetchOrg()}>
          Retry
        </button>
      </div>
    );
  }

  const currentMonthYearName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Row 1: Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Overview</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          All centers — {currentMonthYearName}
        </p>
      </div>

      {/* Row 2: Top Metrics Grid */}
      <div className="metrics-grid cols-4" style={{ marginBottom: 24 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/students')}>
          <MetricCard
            label="TOTAL STUDENTS"
            value={d.total_students ?? '—'}
            sub="Active enrollments"
            variant="green"
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/centers')}>
          <MetricCard
            label="ACTIVE CENTERS"
            value={d.active_centers ?? '—'}
            sub="All operational"
            variant="blue"
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/teachers')}>
          <MetricCard
            label="TEACHERS"
            value={d.total_teachers ?? '—'}
            sub="Across all centers"
            variant="neutral"
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/courses')}>
          <MetricCard
            label="ACTIVE COURSES"
            value={courseEnrollments.length || '—'}
            sub="Published across centers"
            variant="gold"
          />
        </div>
      </div>

      {/* Row 3: Two-column layout (Center Performance + Financial Overview) */}
      <div className="col-63" style={{ marginBottom: 24 }}>
        {/* Left: Center Performance Comparison */}
        <Card>
          <CardHeader style={{ padding: '16px 20px', borderBottom: '1px solid var(--sand-mid)' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Center Performance</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-pale)', margin: '2px 0 0 0' }}>
                Center performance comparison & attendance level
              </p>
            </div>
            <Link to="/admin/centers" style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 500 }}>
              View all centers →
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            <DataTable
              columns={centerTableColumns}
              rows={centerRows}
              loading={centersQuery.isLoading || centerStatsQuery.isLoading}
              emptyTitle="No centers found"
              emptyDescription="No active centers registered in the organization."
            />
          </CardBody>
        </Card>

        {/* Right: Financial Overview (Donations, Salaries Paid, Fees Collected) */}
        <Card>
          <CardHeader style={{ padding: '16px 20px', borderBottom: '1px solid var(--sand-mid)' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Financial Overview</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-pale)', margin: '2px 0 0 0' }}>
                Overall centers summary — {currentMonthYearName}
              </p>
            </div>
            <Link to="/admin/donations" style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 500 }}>
              Details →
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 20 }}>
            {centerFinancialsQuery.isLoading || donationsQuery.isLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. Donations this month */}
                <div
                  style={{
                    background: 'var(--sand-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    border: '1px solid var(--sand-mid)',
                    borderLeft: '4px solid var(--emerald)',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-pale)', fontWeight: 600, letterSpacing: '0.04em' }}>
                    Donations (This Month)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--emerald)', marginTop: 2 }}>
                    {formatCurrency(monthlyDonationsTotal)}
                  </div>
                </div>

                {/* 2. Salaries paid this month */}
                <div
                  style={{
                    background: 'var(--sand-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    border: '1px solid var(--sand-mid)',
                    borderLeft: '4px solid var(--blue)',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-pale)', fontWeight: 600, letterSpacing: '0.04em' }}>
                    Salaries Paid (This Month)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>
                    {formatCurrency(monthlySalariesTotal)}
                  </div>
                </div>

                {/* 3. Fees Collected this month */}
                <div
                  style={{
                    background: 'var(--sand-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    border: '1px solid var(--sand-mid)',
                    borderLeft: '4px solid var(--gold)',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-pale)', fontWeight: 600, letterSpacing: '0.04em' }}>
                    Fees Collected (This Month)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)', marginTop: 2 }}>
                    {formatCurrency(monthlyFeesTotal)}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Row 4: Two-column layout (Academic Insights + Recent System Activity) */}
      <div className="two-col">
        {/* Left: Academic Insights */}
        <Card>
          <CardHeader style={{ padding: '16px 20px', borderBottom: '1px solid var(--sand-mid)' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Academic Insights</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-pale)', margin: '2px 0 0 0' }}>
                Course enrollment distribution
              </p>
            </div>
            <Link to="/admin/courses" style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 500 }}>
              Courses →
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 20 }}>
            {sortedCourses.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-pale)', padding: '20px 0', textAlign: 'center' }}>
                No course enrollment data available yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sortedCourses.map((course, idx) => {
                  const count = course.count || 0;
                  const fillPct = Math.round((count / maxEnrollment) * 100);
                  const variant = courseVariantColors[idx % courseVariantColors.length];

                  return (
                    <div key={course.course || idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                            {course.course || `Course #${idx + 1}`}
                          </span>
                          {course.course_ur && (
                            <span style={{ fontSize: 13, color: 'var(--ink-pale)', marginLeft: 8, fontFamily: 'var(--font-display)' }}>
                              ({course.course_ur})
                            </span>
                          )}
                        </div>
                        <Badge variant={variant}>{count} Enrolled</Badge>
                      </div>
                      <ProgressBar value={fillPct} variant={variant} height={6} />
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '1px solid var(--sand-mid)',
                fontSize: 12,
                color: 'var(--ink-soft)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>📊</span>
              <span>
                Total <strong>{d.total_students ?? 0}</strong> active students enrolled across{' '}
                <strong>{d.active_centers ?? 0}</strong> operating centers.
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Right: Recent System Activity */}
        <Card>
          <CardHeader style={{ padding: '16px 20px', borderBottom: '1px solid var(--sand-mid)' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Activity</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-pale)', margin: '2px 0 0 0' }}>
                System-wide audit trail
              </p>
            </div>
          </CardHeader>
          <CardBody style={{ padding: 20 }}>
            {activityQuery.isLoading ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : activityList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-pale)', padding: '20px 0', textAlign: 'center' }}>
                No recent system activity logged.
              </div>
            ) : (
              <div>
                {activityList.slice(0, 6).map((item, idx) => {
                  const act = (item.action || '').toLowerCase();
                  let dotColorClass = 'feed-dot-green';
                  if (act.includes('delete') || act.includes('remove') || act.includes('deactivate')) {
                    dotColorClass = 'feed-dot-red';
                  } else if (act.includes('update') || act.includes('edit') || act.includes('change')) {
                    dotColorClass = 'feed-dot-gold';
                  }

                  return (
                    <div key={item.id || idx} className="feed-item">
                      <div className={`feed-dot ${dotColorClass}`} />
                      <div className="feed-text">
                        {item.summary_en || item.action}
                        {item.actor_full_name && (
                          <span style={{ fontSize: 11, color: 'var(--ink-pale)', display: 'block' }}>
                            by {item.actor_full_name} ({item.actor_role || 'system'})
                          </span>
                        )}
                      </div>
                      <div className="feed-time">{formatRelativeTime(item.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
