import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

// ── Nav config ────────────────────────────────────────────────────────────────
// Each item may carry an optional `requires` field:
//   string  → user must have that permission key
//   string[] → user must have ANY of those keys
// Items without `requires` are always shown.
// When permissions are not yet loaded, all items are shown (no flash).

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
          { to: '/admin/centers', label: 'Centers', icon: '⊙', requires: 'centers.view' },
        ],
      },
      {
        title: 'Academic',
        items: [
          { to: '/admin/courses', label: 'Courses', icon: '◈', requires: 'courses.view' },
          { to: '/admin/teachers', label: 'Teachers', icon: '◉', requires: 'users.view' },
          { to: '/admin/students', label: 'Students', icon: '○', requires: 'users.view' },
        ],
      },
      {
        title: 'Finance',
        items: [
          { to: '/admin/donations', label: 'Donations', icon: '◈', requires: 'donations.view' },
          { to: '/admin/salaries', label: 'Salaries', icon: '⚹', requires: 'salaries.view' },
        ],
      },
      {
        title: 'Reports & Settings',
        items: [
          { to: '/admin/reports', label: 'Org Report', icon: '▦', requires: 'reports.view_org' },
          { to: '/admin/rbac', label: 'Roles & Perms', icon: '⚙', requires: 'roles.view' },
          { to: '/admin/org', label: 'Settings', icon: '⚙', requires: 'org.edit' },
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
          { to: '/manager/dashboard', label: 'Dashboard', icon: '⊞' },
          { to: '/manager/centers', label: 'My Center', icon: '⊙', requires: 'centers.view' },
          { to: '/manager/classes', label: 'Classes', icon: '◈', requires: 'classes.view' },
          { to: '/manager/teachers', label: 'Teachers', icon: '◉' },
          { to: '/manager/enrollments', label: 'Enrollment', icon: '○', requires: 'enrollments.view' },
          { to: '/manager/attendance', label: 'Attendance', icon: '☑', requires: 'attendance.view' },
        ],
      },
      {
        title: 'Finance',
        items: [
          { to: '/manager/donations', label: 'Donations', icon: '◈' },
          { to: '/manager/salaries', label: 'Salaries', icon: '⚹', requires: 'salaries.view' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { to: '/manager/reports', label: 'Center Report', icon: '▦', requires: 'reports.view_center' },
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
          { to: '/teacher/dashboard', label: 'Dashboard', icon: '⊞' },
          { to: '/teacher/attendance', label: 'Attendance', icon: '☑', requires: 'attendance.mark' },
          { to: '/teacher/progress', label: 'Log Progress', icon: '◈', requires: 'progress.create' },
          { to: '/teacher/progress/class', label: 'Class Overview', icon: '◉', requires: 'progress.view' },
          { to: '/teacher/assessments', label: 'Assessments', icon: '▦', requires: 'assessments.view' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { to: '/teacher/reports/homework', label: 'HW Report', icon: '▦', requires: 'reports.view_student' },
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
          { to: '/student/dashboard', label: 'My Progress', icon: '⊞' },
          { to: '/student/attendance', label: 'Attendance', icon: '☑', requires: 'attendance.view' },
          { to: '/student/schedule', label: 'Schedule', icon: '◉' },
          { to: '/student/results', label: 'Results', icon: '▦', requires: 'assessments.view' },
        ],
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const label = [...parts].reverse().find((p) => !UUID_RE.test(p)) ?? parts[0] ?? 'Dashboard';
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppShell() {
  const { user, role, logout } = useAuth();
  const { can, loaded } = usePermissions();
  const location = useLocation();

  const rawConfig = NAV_CONFIG[role ?? 'student'] ?? NAV_CONFIG.student;

  // For center_manager, swap the MY_CENTER placeholder with their actual center URL.
  const config = role === 'center_manager' && user?.center_id
    ? {
      ...rawConfig,
      sections: rawConfig.sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.label === 'My Center'
            ? { ...item, to: `/manager/centers/${user.center_id}` }
            : item,
        ),
      })),
    }
    : rawConfig;

  // Returns true if this nav item should be shown.
  // When permissions are not loaded, all items are shown (prevents layout flash).
  function canSeeItem(item) {
    if (!item.requires) return true;
    if (!loaded) return true; // not loaded yet — show everything
    const keys = [].concat(item.requires);
    return keys.some((k) => can(k));
  }

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
          {config.sections.map((section) => {
            const visibleItems = section.items.filter(canSeeItem);
            if (visibleItems.length === 0) return null; // hide empty sections
            return (
              <div key={section.title}>
                <div className="nav-section-title">{section.title}</div>
                {visibleItems.map((item) => (
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
            );
          })}
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
