import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useAuth } from './hooks/useAuth';

import AuthLayout     from './layouts/AuthLayout';
import AppShell       from './layouts/AppShell';
import ProtectedRoute from './components/ProtectedRoute';

import SignIn         from './pages/auth/SignIn';
import SignUp         from './pages/auth/SignUp';

import AdminDashboard from './pages/admin/Dashboard';
import CentersList    from './pages/admin/Centers/CentersList';
import CenterDetail   from './pages/admin/Centers/CenterDetail';
import OrgSettings    from './pages/admin/Org/OrgSettings';

import CoursesList    from './pages/admin/Courses/CoursesList';
import CourseDetail   from './pages/admin/Courses/CourseDetail';

import ClassesList       from './pages/manager/Classes/ClassesList';
import ClassDetail       from './pages/manager/Classes/ClassDetail';

import EnrollmentsList   from './pages/manager/Enrollments/EnrollmentsList';
import EnrollmentForm    from './pages/manager/Enrollments/EnrollmentForm';

import DonationsList     from './pages/manager/Finance/DonationsList';
import RecordDonation    from './pages/manager/Finance/RecordDonation';

import MarkAttendance    from './pages/teacher/Attendance/MarkAttendance';
import AttendanceSheet   from './pages/teacher/Attendance/AttendanceSheet';
import MyAttendance      from './pages/student/Attendance/MyAttendance';

import Enrollment     from './pages/manager/Enrollment';

import Placeholder    from './pages/Placeholder';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/signin"   replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />

              {/* Auth — redirect away if already logged in */}
              <Route element={<AuthLayout />}>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
              </Route>

              {/* App shell — any authenticated user */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>

                  {/* Dashboard */}
                  <Route path="/dashboard" element={<AdminDashboard />} />

                  {/* Centers & Manager Features — super_admin + center_manager */}
                  <Route element={<ProtectedRoute roles={['super_admin', 'center_manager']} />}>
                    <Route path="/admin/centers"     element={<CentersList />} />
                    <Route path="/admin/centers/:id" element={<CenterDetail />} />
                    <Route path="/enrollment"        element={<Enrollment />} />
                  </Route>

                  {/* Org settings — super_admin only */}
                  <Route element={<ProtectedRoute roles={['super_admin']} />}>
                    <Route path="/admin/org" element={<OrgSettings />} />
                  </Route>

                  {/* Courses & topics — any authenticated */}
                  <Route path="/admin/courses"     element={<CoursesList />} />
                  <Route path="/admin/courses/:id" element={<CourseDetail />} />

                  {/* Legacy redirect */}
                  <Route path="/centers" element={<Navigate to="/admin/centers" replace />} />

                  {/* Legacy redirect */}
                  <Route path="/courses" element={<Navigate to="/admin/courses" replace />} />

                  {/* Classes — center_manager + teacher */}
                  <Route element={<ProtectedRoute roles={['center_manager', 'teacher']} />}>
                    <Route path="/classes"     element={<ClassesList />} />
                    <Route path="/classes/:id" element={<ClassDetail />} />
                  </Route>

                  {/* Enrollments & Finance — center_manager only */}
                  <Route element={<ProtectedRoute roles={['center_manager']} />}>
                    <Route path="/enrollment"     element={<EnrollmentsList />} />
                    <Route path="/enrollment/new" element={<EnrollmentForm />} />
                    
                    <Route path="/donations"     element={<DonationsList />} />
                    <Route path="/donations/new" element={<RecordDonation />} />
                  </Route>

                  {/* Attendance — role-split */}
                  <Route element={<ProtectedRoute roles={['center_manager', 'teacher']} />}>
                    <Route path="/attendance"       element={<MarkAttendance />} />
                    <Route path="/attendance/sheet" element={<AttendanceSheet />} />
                  </Route>
                  <Route element={<ProtectedRoute roles={['student']} />}>
                    <Route path="/attendance/my" element={<MyAttendance />} />
                  </Route>

                  <Route path="/teachers"    element={<Placeholder />} />
                  <Route path="/students"    element={<Placeholder />} />
                  <Route path="/reports"     element={<Placeholder />} />
                  <Route path="/settings"    element={<Navigate to="/admin/org" replace />} />
                  <Route path="/classes"     element={<Placeholder />} />
                  <Route path="/attendance"  element={<Placeholder />} />
                  <Route path="/progress"    element={<Placeholder />} />
                  <Route path="/assessments" element={<Placeholder />} />
                  <Route path="/schedule"    element={<Placeholder />} />
                  <Route path="/results"     element={<Placeholder />} />

                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
