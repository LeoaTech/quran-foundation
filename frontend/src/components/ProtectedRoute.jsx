import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Forbidden() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, color: 'var(--sand-deep)' }}>403</div>
      <div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>You don't have permission to view this page.</div>
    </div>
  );
}

/**
 * Protects a subtree of routes.
 * - Redirects unauthenticated users to /signin.
 * - If `roles` prop is provided, shows a 403 view when the user's role is not in the list.
 * Renders <Outlet /> so it can be used as a layout route in react-router v6.
 */
export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) return <Navigate to="/signin" replace />;

  if (roles && roles.length > 0 && !roles.includes(role)) {
    return <Forbidden />;
  }

  return <Outlet />;
}
