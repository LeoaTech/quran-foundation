import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Protects a subtree of routes.
 * - Redirects unauthenticated users to /auth/signin.
 * - If `roles` prop is provided, redirects to /403 when the user's role is not in the list.
 * Renders <Outlet /> so it can be used as a layout route in react-router v6.
 */
export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) return <Navigate to="/auth/signin" replace />;

  if (roles && roles.length > 0 && !roles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
