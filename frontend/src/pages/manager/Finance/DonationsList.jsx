import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { getDonations } from '../../../api/donations';

function thStyle() {
  return { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)' };
}

function tdStyle(hasBorder = true) {
  return { padding: '11px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: hasBorder ? '1px solid var(--sand)' : 'none', verticalAlign: 'middle' };
}

export default function DonationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const centerId = user?.center_id;

  const [donorTypeFilter, setDonorTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: donationsRaw, isLoading, error } = useQuery({
    queryKey: ['donations', centerId, donorTypeFilter, page],
    queryFn: () => getDonations(centerId, { donor_type: donorTypeFilter, page }),
    enabled: !!centerId,
    staleTime: 30_000,
  });

  const donations = donationsRaw?.data ?? [];
  const meta = donationsRaw?.meta;

  if (error) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Failed to load donations.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Donations
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {meta?.total ?? 0} record{meta?.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/donations/new')}>+ Record Donation</Button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select
          className="f-select"
          style={{ width: 180 }}
          value={donorTypeFilter}
          onChange={(e) => { setDonorTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Donor Types</option>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="visitor">Visitor</option>
          <option value="guardian">Guardian</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : donations.length === 0 ? (
        <EmptyState
          icon="💸"
          title="No donations found"
          description={donorTypeFilter ? 'No donations match this filter.' : 'Record your first donation.'}
          action={<Button variant="primary" onClick={() => navigate('/donations/new')}>+ Record Donation</Button>}
        />
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle()}>Date</th>
                <th style={thStyle()}>Donor</th>
                <th style={thStyle()}>Type</th>
                <th style={thStyle()}>Amount (PKR)</th>
                <th style={thStyle()}>Purpose</th>
                <th style={thStyle()}>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d, i) => {
                const isLast = i === donations.length - 1;
                return (
                  <tr key={d.id}>
                    <td style={tdStyle(!isLast)}>
                      {new Date(d.date_received).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{d.donor_name}</div>
                      {d.donor_phone && <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{d.donor_phone}</div>}
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <span style={{ textTransform: 'capitalize' }}>{d.donor_type}</span>
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>{Number(d.amount).toLocaleString()}</span>
                    </td>
                    <td style={tdStyle(!isLast)}>{d.purpose}</td>
                    <td style={tdStyle(!isLast)}>{d.recorded_by_name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)', alignSelf: 'center' }}>Page {page} of {meta.total_pages}</span>
          <Button size="sm" variant="outline" disabled={page === meta.total_pages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
