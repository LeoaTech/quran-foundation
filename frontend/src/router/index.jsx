import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import AppShell from '../layouts/AppShell';
import ProtectedRoute from '../components/ProtectedRoute';

// Error pages
import NotFound from '../pages/errors/NotFound';
import Forbidden from '../pages/errors/Forbidden';

// Auth
import SignIn from '../pages/auth/SignIn';
import SignUp from '../pages/auth/SignUp';

// Super admin
import AdminDashboard from '../pages/admin/Dashboard';
import CentersList from '../pages/admin/Centers/CentersList';
import CenterDetail from '../pages/admin/Centers/CenterDetail';
import OrgSettings from '../pages/admin/Org/OrgSettings';
import CoursesList from '../pages/admin/Courses/CoursesList';
import CourseDetail from '../pages/admin/Courses/CourseDetail';
import TeachersList from '../pages/manager/Teachers/TeachersList';
import StudentsList from '../pages/admin/Students/StudentsList';
import OrgReport from '../pages/admin/Reports/OrgReport';
import RBACPage from '../pages/admin/RBAC/RBACPage';
import PermissionsPage from '../pages/admin/RBAC/PermissionsPage';
import UserProfilePage from '../pages/admin/Users/UserProfilePage';
import UserPermissionsPage from '../pages/admin/Users/UserPermissionsPage';

// Center manager
import ManagerDashboard from '../pages/manager/Dashboard';
import ClassesList from '../pages/manager/Classes/ClassesList';
import ClassDetail from '../pages/manager/Classes/ClassDetail';
import EnrollmentForm from '../pages/manager/Enrollment';
import EnrollmentsList from '../pages/manager/Enrollments/EnrollmentsList';
import CenterReport from '../pages/admin/Reports/CenterReport';
import DonationsList from '../pages/manager/Finance/DonationsList';
import RecordDonation from '../pages/manager/Finance/RecordDonation';
import SalariesTab      from '../pages/manager/Finance/SalariesTab';
import FinanceDashboard from '../pages/finance/Dashboard';

// Teacher
import TeacherDashboard from '../pages/teacher/Dashboard';
import TeacherClassesList from '../pages/teacher/Classes/ClassesList';
import TeacherClassDetail from '../pages/teacher/Classes/ClassDetail';
import MarkAttendance from '../pages/teacher/Attendance/MarkAttendance';
import AttendanceSheet from '../pages/teacher/Attendance/AttendanceSheet';
import ProgressLogger from '../pages/teacher/Progress/ProgressLogger';
import ClassProgress from '../pages/teacher/Progress/ClassProgress';
import AssessmentsList from '../pages/teacher/Assessments/AssessmentsList';
import AssessmentDetail from '../pages/teacher/Assessments/AssessmentDetail';
import HomeworkReport from '../pages/teacher/Reports/HomeworkReport';

// Student
import MyProgress from '../pages/student/Progress/MyProgress';
import MyAttendance from '../pages/student/Attendance/MyAttendance';
import Schedule from '../pages/student/Schedule';
import MyAssessments from '../pages/student/Assessments/MyAssessments';

// Shared
import StudentReport from '../pages/shared/Reports/StudentReport';
import Students from '../pages/manager/Students';

export const ROLE_DASHBOARDS = {
  super_admin:     '/admin/dashboard',
  center_manager:  '/manager/dashboard',
  finance_manager: '/finance/dashboard',
  teacher:         '/teacher/dashboard',
  student:         '/student/dashboard',
};

function RootRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/signin" replace />;
  return <Navigate to={ROLE_DASHBOARDS[role] ?? '/admin/dashboard'} replace />;
}

export default function AppRoutes() {
  return (
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
  );
}
