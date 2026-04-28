import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    sub: 'All centers',
    badgeClass: 'badge-superadmin',
    sections: [
      {
        title: 'Overview',
        items: [
          { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
          { to: '/centers',   label: 'Centers',   icon: '⊙' },
        ],
      },
      {
        title: 'Academic',
        items: [
          { to: '/courses',  label: 'Courses',  icon: '◈' },
          { to: '/teachers', label: 'Teachers', icon: '◉' },
          { to: '/students', label: 'Students', icon: '○' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { to: '/reports',  label: 'Reports',  icon: '▦' },
          { to: '/settings', label: 'Settings', icon: '⚙' },
        ],
      },
    ],
  },
  center_manager: {
    label: 'Center Manager',
    sub: 'My Center',
    badgeClass: 'badge-manager',
    sections: [
      {
        title: 'My Center',
        items: [
          { to: '/dashboard',  label: 'Dashboard',  icon: '⊞' },
          { to: '/classes',    label: 'Classes',    icon: '◈' },
          { to: '/enrollment', label: 'Enrollment', icon: '○' },
          { to: '/attendance', label: 'Attendance', icon: '☑' },
        ],
      },
      {
        title: 'Admin',
        items: [
          { to: '/reports', label: 'Reports', icon: '▦' },
        ],
      },
    ],
  },
  teacher: {
    label: 'Teacher',
    sub: 'My Classes',
    badgeClass: 'badge-teacher',
    sections: [
      {
        title: 'My Classes',
        items: [
          { to: '/dashboard',   label: 'Dashboard',     icon: '⊞' },
          { to: '/attendance',  label: 'Attendance',    icon: '☑' },
          { to: '/progress',    label: 'Log Progress',  icon: '◈' },
          { to: '/assessments', label: 'Assessments',   icon: '▦' },
        ],
      },
    ],
  },
  student: {
    label: 'Student',
    sub: 'My Learning',
    badgeClass: 'badge-student',
    sections: [
      {
        title: 'My Learning',
        items: [
          { to: '/dashboard',  label: 'My Progress', icon: '⊞' },
          { to: '/attendance', label: 'Attendance',  icon: '☑' },
          { to: '/schedule',   label: 'Schedule',    icon: '◉' },
          { to: '/results',    label: 'Results',     icon: '▦' },
        ],
      },
    ],
  },
};

function initials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '??';
}

function pageTitle(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export default function AppShell() {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user)   return <Navigate to="/signin" replace />;

  const role = user.roles?.[0] ?? 'student';
  const config = NAV_CONFIG[role] ?? NAV_CONFIG.student;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-arabic">قرآن فاؤنڈیشن</div>
          <div className="sidebar-logo-en">Quran Foundation LMS</div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials(user.full_name)}</div>
          <div>
            <div className="sidebar-user-name">{user.full_name}</div>
            <div className="sidebar-user-role">{config.sub}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {config.sections.map((section) => (
            <div key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">{pageTitle(location.pathname)}</div>
          <div className="topbar-right">
            <span className={`topbar-badge ${config.badgeClass}`}>{config.label}</span>
          </div>
        </header>
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
