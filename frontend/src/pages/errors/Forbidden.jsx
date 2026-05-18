import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ROLE_DASHBOARDS = {
  super_admin:    '/admin/dashboard',
  center_manager: '/manager/dashboard',
  teacher:        '/teacher/dashboard',
  student:        '/student/dashboard',
};

export default function Forbidden() {
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
          color: 'var(--red-light)',
          lineHeight: 1,
          marginBottom: 8,
          fontFamily: 'var(--font-body)',
        }}
      >
        403
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          color: 'var(--ink)',
          marginBottom: 6,
          direction: 'rtl',
        }}
      >
        آپ کو یہ صفحہ دیکھنے کی اجازت نہیں ہے
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 28, maxWidth: 380 }}>
        You don't have permission to view this page. Contact your administrator if you believe this is an error.
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
