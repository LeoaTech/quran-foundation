import { useAuth } from '../../hooks/useAuth';

const QUICK_LINKS = [
  { label: 'Mark attendance',  to: '/teacher/attendance',      icon: '☑', desc: "Record today's session" },
  { label: 'Log progress',     to: '/teacher/progress',        icon: '◈', desc: 'Enter classwork & homework' },
  { label: 'Class overview',   to: '/teacher/progress/class',  icon: '◉', desc: 'View all students' },
  { label: 'Assessments',      to: '/teacher/assessments',     icon: '▦', desc: 'Manage tests & results' },
];

export default function TeacherDashboard() {
  const { user } = useAuth();

  return (
    <>
      <div className="page-header">
        <h2>Welcome, {user?.full_name ?? 'Teacher'}</h2>
        <p>{new Date().toLocaleString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {QUICK_LINKS.map(({ label, to, icon, desc }) => (
          <a
            key={to}
            href={to}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '20px 18px',
              background: 'var(--white)',
              border: '1px solid var(--sand-mid)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--emerald)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,107,82,0.10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--sand-mid)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: 24, color: 'var(--emerald)' }}>{icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{desc}</span>
          </a>
        ))}
      </div>
    </>
  );
}
