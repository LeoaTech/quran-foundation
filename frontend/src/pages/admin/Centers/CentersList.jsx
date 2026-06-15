import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import PageHeader from '../../../components/PageHeader';
import Badge from '../../../components/Badge';
import ProgressBar from '../../../components/ProgressBar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import AddCenterModal from './AddCenterModal';
import { getCenters, getCenterOverview } from '../../../api/centers';
import { useIsMobile } from '../../../hooks/useIsMobile';

export default function CentersList() {
  const { role, user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const isMobile = useIsMobile()
  // center_manager goes straight to their own center
  useEffect(() => {
    if (role === 'center_manager' && user?.center_id) {
      navigate(`/admin/centers/${user.center_id}`, { replace: true });
    }
  }, [role, user, navigate]);

  const { data: centersData, isLoading, error } = useQuery({
    queryKey: ['centers'],
    queryFn: () => getCenters(),
    staleTime: 60_000,
  });

  const centers = centersData?.data ?? centersData ?? [];

  const reportQueries = useQueries({
    queries: centers.map((c) => ({
      queryKey: ['center-overview', c.id],
      queryFn: () => getCenterOverview(c.id),
      staleTime: 3 * 60_000,
      enabled: centers.length > 0,
    })),
  });

  const reportByIndex = Object.fromEntries(
    centers.map((c, i) => [c.id, reportQueries[i]?.data]),
  );

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <>
      <AddCenterModal open={showAdd} onClose={() => setShowAdd(false)} />

      <PageHeader
        title="Centers"
        subtitle="All Quran Foundation learning centers"
        action={can('centers.create') ? { label: '+ Add center', onClick: () => setShowAdd(true) } : undefined}
      />

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          Failed to load centers.
        </div>
      )}

      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {centers.length === 0 && !isLoading ? (
          <EmptyState
            icon="⊙"
            title="No centers yet"
            description="Create the first center to get started."
            action={can('centers.create') ? { label: '+ Add center', onClick: () => setShowAdd(true) } : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Name (Urdu)', 'City', 'Students', 'Teachers', 'Attendance', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 14px 10px', borderBottom: '1px solid var(--sand-mid)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {centers.map((center) => {
                  const report = reportByIndex[center.id];
                  const pct = report?.attendance_pct ?? null;

                  return (
                    <tr
                      key={center.id}
                      onClick={() => navigate(`/admin/centers/${center.id}`)}
                      style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sand)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{center.name}</span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', fontSize: 14, direction: 'rtl' }}>
                        {center.name_ur ?? '—'}
                      </td>
                      <td style={tdStyle}>{center.city ?? '—'}</td>
                      <td style={tdStyle}>{report?.active_students ?? <span style={{ color: 'var(--ink-pale)' }}>—</span>}</td>
                      <td style={tdStyle}>{report?.active_teachers ?? <span style={{ color: 'var(--ink-pale)' }}>—</span>}</td>
                      <td style={{ ...tdStyle, minWidth: 100 }}>
                        {pct != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProgressBar value={pct} style={{ flex: 1, minWidth: 60 }} />
                            <span style={{ fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{pct}%</span>
                          </div>
                        ) : <span style={{ color: 'var(--ink-pale)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <Badge variant={center.is_active ? 'green' : 'sand'}>
                          {center.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/admin/centers/${center.id}`)}
                          style={{ background: 'none', border: 'none', color: 'var(--emerald)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const tdStyle = {
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--ink-mid)',
  borderBottom: '1px solid var(--sand)',
  verticalAlign: 'middle',
};
