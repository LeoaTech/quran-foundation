import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/admin/rbac',             label: 'Roles',       exact: true },
  { to: '/admin/rbac/permissions', label: 'Permissions', exact: false },
];

export default function RBACTabs() {
  const { pathname } = useLocation();
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--sand-mid)', marginBottom: 20, gap: 0 }}>
      {TABS.map(({ to, label, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            style={{
              padding: '10px 20px 11px',
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--emerald)' : 'var(--ink-pale)',
              borderBottom: `2.5px solid ${active ? 'var(--emerald)' : 'transparent'}`,
              marginBottom: -1,
              textDecoration: 'none',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
