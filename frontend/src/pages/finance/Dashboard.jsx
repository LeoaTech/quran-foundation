import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardBody } from '../../components/Card';
import MetricCard from '../../components/MetricCard';
import ActivityLogTab from '../admin/Centers/ActivityLogTab';
import DonationsList from '../manager/Finance/DonationsList';
import EnrollmentsList from '../manager/Enrollments/EnrollmentsList';
import SalariesTab from '../manager/Finance/SalariesTab';
import TeachersList from '../admin/Teachers/TeachersList';
import EmptyState from '../../components/EmptyState';

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1.5px solid var(--sand-mid)', marginBottom: 24, overflowX: 'auto', gap: 16 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '10px 4px 12px',
            fontSize: 14, fontWeight: 500,
            color: active === t.id ? 'var(--emerald)' : 'var(--ink-pale)',
            borderBottom: active === t.id ? '2.5px solid var(--emerald)' : '2.5px solid transparent',
            marginBottom: -1.5,
            background: 'none', border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'color 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Ledger tab (placeholder) ──────────────────────────────────────────────────

function LedgerTab() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total Donations (Month)" value="PKR 0" variant="gold" />
        <MetricCard label="Fees Collected (Month)" value="PKR 0" variant="green" />
        <MetricCard label="Salaries Paid (Month)" value="PKR 0" variant="blue" />
      </div>
      <Card>
        <CardHeader><span className="card-title">Recent Transactions</span></CardHeader>
        <CardBody style={{ padding: 0 }}>
          <EmptyState icon="" title="Summary coming soon" description="Center ledger overview will be available here." />
        </CardBody>
      </Card>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'ledger', label: 'Overview' },
];

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ledger');

  const centerId = user?.center_id;

  return (
    <div
   >
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'ledger' && <LedgerTab />}
   </div>
  );
}
