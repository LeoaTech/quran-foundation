import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
          { to: '/admin/dashboard', label: 'Dashboard', icon: '⊞' },
          { to: '/admin/centers',   label: 'Centers',   icon: '⊙' },
        ],
      },
      {
        title: 'Academic',
        items: [
          { to: '/admin/courses',   label: 'Courses',   icon: '◈' },
          { to: '/admin/teachers',  label: 'Teachers',  icon: '◉' },
          { to: '/admin/students',  label: 'Students',  icon: '○' },
        ],
      },
      {
        title: 'Reports & Settings',
        items: [
          { to: '/admin/reports', label: 'Org Report',        icon: '▦' },
          { to: '/admin/rbac',    label: 'Roles & Perms',     icon: '⚙' },
          { to: '/admin/org',     label: 'Settings',          icon: '⚙' },
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
          { to: '/manager/dashboard',   label: 'Dashboard',  icon: '⊞' },
          { to: 'MY_CENTER',            label: 'My Center',  icon: '⊙' },
          { to: '/manager/classes',     label: 'Classes',    icon: '◈' },
          { to: '/manager/enrollments', label: 'Enrollment', icon: '○' },
          { to: '/manager/attendance',  label: 'Attendance', icon: '☑' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { to: '/manager/reports', label: 'Center Report', icon: '▦' },
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
          { to: '/teacher/dashboard',       label: 'Dashboard',     icon: '⊞' },
          { to: '/teacher/attendance',      label: 'Attendance',    icon: '☑' },
          { to: '/teacher/progress',        label: 'Log Progress',  icon: '◈' },
          { to: '/teacher/progress/class',  label: 'Class Overview', icon: '◉' },
          { to: '/teacher/assessments',     label: 'Assessments',   icon: '▦' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { to: '/teacher/reports/homework', label: 'HW Report', icon: '▦' },
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
          { to: '/student/dashboard',  label: 'My Progress', icon: '⊞' },
          { to: '/student/attendance', label: 'Attendance',  icon: '☑' },
          { to: '/student/schedule',   label: 'Schedule',    icon: '◉' },
          { to: '/student/results',    label: 'Results',     icon: '▦' },
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
  const parts = pathname.split('/').filter(Boolean);
  // Use the last segment unless it's a UUID — then fall back to the one before
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const label   = [...parts].reverse().find((p) => !UUID_RE.test(p)) ?? parts[0] ?? 'Dashboard';
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ');
}

export default function AppShell() {
  const { user, role, logout } = useAuth();
  const location = useLocation();

  const rawConfig = NAV_CONFIG[role ?? 'student'] ?? NAV_CONFIG.student;

  // For center_manager, swap the MY_CENTER placeholder with their actual center URL
  const config = role === 'center_manager' && user?.center_id
    ? {
        ...rawConfig,
        sections: rawConfig.sections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.label === 'My Center'
              ? { ...item, to: `/admin/centers/${user.center_id}` }
              : item,
          ),
        })),
      }
    : rawConfig;

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
          <button className="btn-signout" onClick={logout}>Sign out</button>
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
