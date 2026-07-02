import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ROUTE_PATHS, ROLES } from './utils/constants';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Auth
import Login from './pages/auth/Login';

// Protected Route
import ProtectedRoute from './components/ProtectedRoute';

// Super Admin
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import Schools from './pages/super-admin/Schools';

// School Admin
import AdminDashboard from './pages/admin/Dashboard';
import Students from './pages/admin/Students';
import Teachers from './pages/admin/Teachers';
import Classes from './pages/admin/Classes';
import AdminSubjects from './pages/admin/Subjects';
import AdminParents from './pages/admin/Parents';
import AdminFees from './pages/admin/Fees';
import AdminExams from './pages/admin/Exams';
import AdminAttendance from './pages/admin/Attendance';
import AdminNotices from './pages/admin/Notices';
import AdminTransport from './pages/admin/Transport';
import AdminLeaves from './pages/admin/Leaves';
import AdminSettings from './pages/admin/Settings';
import AdminTimetable from './pages/admin/Timetable';
import AdminExpenses from './pages/admin/Expenses';
import AdminEnquiries from './pages/admin/Enquiries';
import AdminStaffAttendance from './pages/admin/StaffAttendance';
import AdminPermissions from './pages/admin/Permissions';
import AdminHolidays from './pages/admin/Holidays';
import AdminLeaderboard from './pages/admin/Leaderboard';

// Teacher
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherResults from './pages/teacher/Results';
import TeacherNotices from './pages/teacher/Notices';
import TeacherLeave from './pages/teacher/Leave';
import TeacherMessages from './pages/teacher/Messages';
import TeacherTimetable from './pages/teacher/Timetable';
import TeacherHolidays from './pages/teacher/Holidays';
import TeacherLeaderboard from './pages/teacher/Leaderboard';
import TeacherDiary from './pages/teacher/Diary';

// Student
import StudentDashboard from './pages/student/Dashboard';
import StudentTimetable from './pages/student/Timetable';
import StudentResults from './pages/student/Results';
import StudentExams from './pages/student/Exams';
import StudentAttendance from './pages/student/Attendance';
import StudentAnalytics from './pages/student/Analytics';
import StudentLeaderboard from './pages/student/Leaderboard';
import StudentLeave from './pages/student/Leave';
import StudentHolidays from './pages/student/Holidays';
import StudentDiary from './pages/student/Diary';

// Parent
import ParentDashboard from './pages/parent/Dashboard';
import ChildProgress from './pages/parent/ChildProgress';
import ParentFees from './pages/parent/Fees';
import ParentTransport from './pages/parent/Transport';
import ParentLeave from './pages/parent/Leave';
import ParentMessages from './pages/parent/Messages';
import ParentNotices from './pages/parent/Notices';
import ParentTimetable from './pages/parent/Timetable';
import ParentHolidays from './pages/parent/Holidays';
import ParentResults from './pages/parent/Results';
import ParentDiary from './pages/parent/Diary';

// Global toast manager
import { Toaster } from './utils/toast';
// PWA — update / offline-ready notifications
import PWAUpdatePrompt from './components/PWAUpdatePrompt';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  // Root redirect — send to role-specific dashboard or login
  const getDefaultRedirect = () => {
    if (!isAuthenticated || !user) return '/login';
    const userRole = user.role?.trim() || '';
    const base = (ROUTE_PATHS as Record<string, string>)[userRole] || '/login';
    return base !== '/login' ? `${base}/dashboard` : '/login';
  };

  return (
    <>
    <Toaster />
    <PWAUpdatePrompt />
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to={getDefaultRedirect()} replace /> : <Login />
      } />

      {/* Super Admin */}
      <Route path="/super-admin" element={
        <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route path="schools" element={<Schools />} />
      </Route>

      {/* School Admin */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={[ROLES.SCHOOL_ADMIN]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="parents" element={<AdminParents />} />
        <Route path="classes" element={<Classes />} />
        <Route path="subjects" element={<AdminSubjects />} />
        <Route path="fees" element={<AdminFees />} />
        <Route path="exams" element={<AdminExams />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="timetable" element={<AdminTimetable />} />
        <Route path="notices" element={<AdminNotices />} />
        <Route path="transport" element={<AdminTransport />} />
        <Route path="leaves" element={<AdminLeaves />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="enquiries" element={<AdminEnquiries />} />
        <Route path="staff-attendance" element={<AdminStaffAttendance />} />
        <Route path="holidays" element={<AdminHolidays />} />
        <Route path="leaderboard" element={<AdminLeaderboard />} />
        <Route path="teachers/:teacherId/permissions" element={<AdminPermissions />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Teacher */}
      <Route path="/teacher" element={
        <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="attendance" element={<TeacherAttendance />} />
        <Route path="timetable" element={<TeacherTimetable />} />
        <Route path="holidays" element={<TeacherHolidays />} />
        <Route path="exams" element={<AdminExams />} />
        <Route path="results" element={<TeacherResults />} />
        <Route path="leaderboard" element={<TeacherLeaderboard />} />
        <Route path="notices" element={<TeacherNotices />} />
        <Route path="leave" element={<TeacherLeave />} />
        <Route path="messages" element={<TeacherMessages />} />
        <Route path="diary" element={<TeacherDiary />} />
      </Route>

      {/* Student */}
      <Route path="/student" element={
        <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="timetable" element={<StudentTimetable />} />
        <Route path="exams" element={<StudentExams />} />
        <Route path="results" element={<StudentResults />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="analytics" element={<StudentAnalytics />} />
        <Route path="leaderboard" element={<StudentLeaderboard />} />
        <Route path="holidays" element={<StudentHolidays />} />
        <Route path="leave" element={<StudentLeave />} />
        <Route path="diary" element={<StudentDiary />} />
      </Route>

      {/* Parent */}
      <Route path="/parent" element={
        <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ParentDashboard />} />
        <Route path="timetable" element={<ParentTimetable />} />
        <Route path="holidays" element={<ParentHolidays />} />
        <Route path="results" element={<ParentResults />} />
        <Route path="child-progress" element={<ChildProgress />} />
        <Route path="fees" element={<ParentFees />} />
        <Route path="transport" element={<ParentTransport />} />
        <Route path="notices" element={<ParentNotices />} />
        <Route path="leave" element={<ParentLeave />} />
        <Route path="messages" element={<ParentMessages />} />
        <Route path="diary" element={<ParentDiary />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={getDefaultRedirect()} replace />} />
    </Routes>
    </>
  );
}

export default App;
