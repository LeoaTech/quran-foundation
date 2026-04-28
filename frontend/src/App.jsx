import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';

import AuthLayout     from './layouts/AuthLayout';
import AppShell       from './layouts/AppShell';
import SignIn         from './pages/auth/SignIn';
import AdminDashboard from './pages/admin/Dashboard';
import Centers        from './pages/admin/Centers';
import Placeholder    from './pages/Placeholder';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/signin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            {/* Auth */}
            <Route element={<AuthLayout />}>
              <Route path="/signin" element={<SignIn />} />
            </Route>

            {/* App */}
            <Route element={<AppShell />}>
              <Route path="/dashboard"   element={<AdminDashboard />} />
              <Route path="/centers"     element={<Centers />} />
              <Route path="/courses"     element={<Placeholder />} />
              <Route path="/teachers"    element={<Placeholder />} />
              <Route path="/students"    element={<Placeholder />} />
              <Route path="/reports"     element={<Placeholder />} />
              <Route path="/settings"    element={<Placeholder />} />
              <Route path="/classes"     element={<Placeholder />} />
              <Route path="/enrollment"  element={<Placeholder />} />
              <Route path="/attendance"  element={<Placeholder />} />
              <Route path="/progress"    element={<Placeholder />} />
              <Route path="/assessments" element={<Placeholder />} />
              <Route path="/schedule"    element={<Placeholder />} />
              <Route path="/results"     element={<Placeholder />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
