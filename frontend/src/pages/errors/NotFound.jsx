import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ROLE_DASHBOARDS = {
  super_admin:    '/admin/dashboard',
  center_manager: '/manager/dashboard',
  teacher:        '/teacher/dashboard',
  student:        '/student/dashboard',
};

export default function NotFound() {
  const { role } = useAuth();
  const home = ROLE_DASHBOARDS[role] ?? '/';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sand)',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          color: 'var(--sand-deep)',
          lineHeight: 1,
          marginBottom: 8,
          fontFamily: 'var(--font-body)',
        }}
      >
        404
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          color: 'var(--ink)',
          marginBottom: 6,
        }}
      >
        صفحہ نہیں ملا
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 28, maxWidth: 360 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to={home}
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          background: 'var(--emerald)',
          color: '#fff',
          borderRadius: 'var(--radius)',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
