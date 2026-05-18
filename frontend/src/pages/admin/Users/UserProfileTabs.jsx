import { Link, useLocation } from 'react-router-dom';

export default function UserProfileTabs({ userId }) {
  const { pathname } = useLocation();
  const tabs = [
    { to: `/admin/users/${userId}`,              label: 'Profile',     exact: true },
    { to: `/admin/users/${userId}/permissions`,  label: 'Permissions', exact: false },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--sand-mid)', marginBottom: 20 }}>
      {tabs.map(({ to, label, exact }) => {
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
