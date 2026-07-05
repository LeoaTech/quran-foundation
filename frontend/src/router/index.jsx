import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

// Layouts - Keep synchronous as they form the app's shell
import AuthLayout from '../layouts/AuthLayout';
import AppShell from '../layouts/AppShell';
import ProtectedRoute from '../components/ProtectedRoute';

// Error pages
const NotFound = lazy(() => import('../pages/errors/NotFound'));
const Forbidden = lazy(() => import('../pages/errors/Forbidden'));

// Auth
const SignIn = lazy(() => import('../pages/auth/SignIn'));
const SignUp = lazy(() => import('../pages/auth/SignUp'));

// Super admin
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'));
const CentersList = lazy(() => import('../pages/admin/Centers/CentersList'));
const CenterDetail = lazy(() => import('../pages/admin/Centers/CenterDetail'));
const OrgSettings = lazy(() => import('../pages/admin/Org/OrgSettings'));
const CoursesList = lazy(() => import('../pages/admin/Courses/CoursesList'));
const CourseDetail = lazy(() => import('../pages/admin/Courses/CourseDetail'));
const TeachersList = lazy(() => import('../pages/manager/Teachers/TeachersList'));
const StudentsList = lazy(() => import('../pages/admin/Students/StudentsList'));
const OrgReport = lazy(() => import('../pages/admin/Reports/OrgReport'));
const RBACPage = lazy(() => import('../pages/admin/RBAC/RBACPage'));
const PermissionsPage = lazy(() => import('../pages/admin/RBAC/PermissionsPage'));
const UserProfilePage = lazy(() => import('../pages/admin/Users/UserProfilePage'));
const UserPermissionsPage = lazy(() => import('../pages/admin/Users/UserPermissionsPage'));

// Center manager
const ManagerDashboard = lazy(() => import('../pages/manager/Dashboard'));
const ClassesList = lazy(() => import('../pages/manager/Classes/ClassesList'));
const ClassDetail = lazy(() => import('../pages/manager/Classes/ClassDetail'));
const EnrollmentForm = lazy(() => import('../pages/manager/Enrollment'));
const EnrollmentsList = lazy(() => import('../pages/manager/Enrollments/EnrollmentsList'));
const CenterReport = lazy(() => import('../pages/admin/Reports/CenterReport'));
const DonationsList = lazy(() => import('../pages/manager/Finance/DonationsList'));
const RecordDonation = lazy(() => import('../pages/manager/Finance/RecordDonation'));
const SalariesTab = lazy(() => import('../pages/manager/Finance/SalariesTab'));
const FinanceDashboard = lazy(() => import('../pages/finance/Dashboard'));

// Teacher
const TeacherDashboard = lazy(() => import('../pages/teacher/Dashboard'));
const TeacherClassesList = lazy(() => import('../pages/teacher/Classes/ClassesList'));
const TeacherClassDetail = lazy(() => import('../pages/teacher/Classes/ClassDetail'));
const MarkAttendance = lazy(() => import('../pages/teacher/Attendance/MarkAttendance'));
const AttendanceSheet = lazy(() => import('../pages/teacher/Attendance/AttendanceSheet'));
const ProgressLogger = lazy(() => import('../pages/teacher/Progress/ProgressLogger'));
const ClassProgress = lazy(() => import('../pages/teacher/Progress/ClassProgress'));
const AssessmentsList = lazy(() => import('../pages/teacher/Assessments/AssessmentsList'));
const AssessmentDetail = lazy(() => import('../pages/teacher/Assessments/AssessmentDetail'));
const HomeworkReport = lazy(() => import('../pages/teacher/Reports/HomeworkReport'));

// Student
const MyProgress = lazy(() => import('../pages/student/Progress/MyProgress'));
const MyAttendance = lazy(() => import('../pages/student/Attendance/MyAttendance'));
const Schedule = lazy(() => import('../pages/student/Schedule'));
const MyAssessments = lazy(() => import('../pages/student/Assessments/MyAssessments'));

// Guardian
const GuardianDashboard = lazy(() => import('../pages/guardian/Dashboard'));

// Shared
const StudentReport = lazy(() => import('../pages/shared/Reports/StudentReport'));
const Students = lazy(() => import('../pages/manager/Students'));

export const ROLE_DASHBOARDS = {
  super_admin:     '/admin/dashboard',
  center_manager:  '/manager/dashboard',
  finance_manager: '/finance/dashboard',
  teacher:         '/teacher/dashboard',
  student:         '/student/dashboard',
  guardian:        '/guardian/dashboard',
};

function RootRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/signin" replace />;
  return <Navigate to={ROLE_DASHBOARDS[role] ?? '/admin/dashboard'} replace />;
}

const SuspenseFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary, #fff)' }}>
    <LoadingSpinner size={48} />
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Auth pages — redirect away if already signed in */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/signup" element={<SignUp />} />
        </Route>

        {/* Legacy auth redirects */}
        <Route path="/signin" element={<Navigate to="/auth/signin" replace />} />
        <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />

        {/* App shell — any authenticated user */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>

            {/* ── Super Admin ── */}
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/centers" element={<CentersList />} />
              <Route path="/admin/centers/:id" element={<CenterDetail />} />
              <Route path="/admin/classes/:id" element={<ClassDetail />} />
              <Route path="/admin/org" element={<OrgSettings />} />
              <Route path="/admin/courses" element={<CoursesList />} />
              <Route path="/admin/courses/:id" element={<CourseDetail />} />
              <Route path="/admin/teachers" element={<TeachersList />} />
              <Route path="/admin/students" element={<Students />} />
              <Route path="/admin/donations" element={<DonationsList />} />
              <Route path="/admin/donations/new" element={<RecordDonation />} />
              <Route path="/admin/salaries" element={<SalariesTab />} />
              <Route path="/admin/reports" element={<OrgReport />} />
              <Route path="/admin/rbac" element={<RBACPage />} />
              <Route path="/admin/rbac/permissions" element={<PermissionsPage />} />
              <Route path="/admin/users/:userId" element={<UserProfilePage />} />
              <Route path="/admin/users/:userId/permissions" element={<UserPermissionsPage />} />
            </Route>

            {/* ── Center Manager ── */}
            <Route element={<ProtectedRoute roles={['center_manager']} />}>
              <Route path="/manager/dashboard" element={<ManagerDashboard />} />
              <Route path="/manager/centers/:id" element={<CenterDetail />} />
              <Route path="/manager/classes" element={<ClassesList />} />
              <Route path="/manager/classes/:id" element={<ClassDetail />} />
              <Route path="/manager/students" element={<Students />} />
              <Route path="/manager/enrollment" element={<EnrollmentForm />} />
              <Route path="/manager/enrollments" element={<EnrollmentsList />} />
              <Route path="/manager/teachers" element={<TeachersList />} />
              <Route path="/manager/donations" element={<DonationsList />} />
              <Route path="/manager/donations/new" element={<RecordDonation />} />
              <Route path="/manager/salaries" element={<SalariesTab />} />
              <Route path="/manager/attendance" element={<AttendanceSheet />} />
              <Route path="/manager/reports" element={<CenterReport />} />
              <Route path="/manager/users/:userId" element={<UserProfilePage />} />
            </Route>

            {/* ── Teacher ── */}
            <Route element={<ProtectedRoute roles={['teacher']} />}>
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/classes" element={<TeacherClassesList />} />
              <Route path="/teacher/classes/:id" element={<TeacherClassDetail />} />
              <Route path="/teacher/attendance" element={<MarkAttendance />} />
              <Route path="/teacher/attendance/sheet" element={<AttendanceSheet />} />
              <Route path="/teacher/progress" element={<ProgressLogger />} />
              <Route path="/teacher/progress/class" element={<ClassProgress />} />
              <Route path="/teacher/assessments" element={<AssessmentsList />} />
              <Route path="/teacher/assessments/:id" element={<AssessmentDetail />} />
              <Route path="/teacher/reports/homework" element={<HomeworkReport />} />
            </Route>

            {/* ── Student ── */}
            <Route element={<ProtectedRoute roles={['student']} />}>
              <Route path="/student/dashboard" element={<MyProgress />} />
              <Route path="/student/attendance" element={<MyAttendance />} />
              <Route path="/student/schedule" element={<Schedule />} />
              <Route path="/student/results" element={<MyAssessments />} />
            </Route>

            {/* ── Guardian ── */}
            <Route element={<ProtectedRoute roles={['guardian']} />}>
              <Route path="/guardian/dashboard" element={<GuardianDashboard />} />
            </Route>

            {/* ── Finance Manager ── */}
            <Route element={<ProtectedRoute roles={['finance_manager']} />}>
              <Route path="/finance/dashboard"    element={<FinanceDashboard />} />
              <Route path="/finance/donations"    element={<DonationsList />} />
              <Route path="/finance/donations/new" element={<RecordDonation />} />
              <Route path="/finance/salaries"     element={<SalariesTab />} />
              <Route path="/finance/teachers"     element={<TeachersList />} />
              <Route path="/finance/enrollments"  element={<EnrollmentsList />} />
            </Route>

            {/* ── Shared (any authenticated role) ── */}
            <Route path="/settings/profile" element={<UserProfilePage />} />
            <Route path="/reports/students/:userId" element={<StudentReport />} />

            {/* ── Shared RBAC Routes ── */}
            {/* <Route element={<ProtectedRoute requiredPermissions={['donations.view']} />}>
              <Route path="/admin/donations" element={<DonationsList />} />
            </Route> */}
            {/* <Route element={<ProtectedRoute requiredPermissions={['donations.create']} />}>
              <Route path="/admin/donations/new" element={<RecordDonation />} />
            </Route> */}
            {/* <Route element={<ProtectedRoute requiredPermissions={['users.view']} />}>
              <Route path="/admin/teachers" element={<TeachersList />} />
              <Route path="/admin/teachers" element={<Navigate to="/teachers" replace />} />
            </Route> */}

          </Route>
        </Route>

        {/* Error pages — no auth wrapper */}
        <Route path="/403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
