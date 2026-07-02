import {
  FiHome, FiUsers, FiBookOpen, FiCalendar, FiDollarSign,
  FiClipboard, FiFileText, FiSettings, FiTruck, FiBell,
  FiBarChart2, FiAward, FiCheckSquare, FiGrid,
  FiUser, FiClock, FiLayers, FiCreditCard, FiMessageSquare,
  FiShield, FiUserCheck,
} from 'react-icons/fi';

export const API_BASE_URL = 'http://localhost:8000/api/v1';

// Origin of the backend (`http://localhost:8000`). Used to turn relative
// server-returned URLs like "/api/v1/diary/image/…" into absolute URLs that
// browsers can fetch from a different origin than the SPA host (Vite dev
// server runs on :5173 while FastAPI is on :8000).
let _apiOrigin = '';
try { _apiOrigin = new URL(API_BASE_URL).origin; } catch { /* noop */ }
export const API_ORIGIN = _apiOrigin;

/**
 * Resolve a possibly-relative URL returned by the backend into an absolute one.
 * Pass-through if the URL is already absolute (http/https) or empty.
 */
export function resolveApiUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/')) return API_ORIGIN + url;
  return url;
}

// Roles must match backend UserRole enum exactly (uppercase)
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
};

// Map roles to their dashboard routes
export const ROUTE_PATHS = {
  'SUPER_ADMIN': '/super-admin',
  'SCHOOL_ADMIN': '/admin',
  'TEACHER': '/teacher',
  'STUDENT': '/student',
  'PARENT': '/parent',
};

// Helper function to get dashboard path by role
export const getRoleDashboardPath = (role) => {
  const dashboardPath = ROUTE_PATHS[role];
  return dashboardPath ? `${dashboardPath}/dashboard` : '/login';
};

export const NAV_ITEMS = {
  [ROLES.SUPER_ADMIN]: [
    { label: 'Dashboard', path: '/super-admin/dashboard', icon: FiHome },
    { label: 'Schools', path: '/super-admin/schools', icon: FiGrid },
  ],
  [ROLES.SCHOOL_ADMIN]: [
    // ── Daily essentials (badge-driven, always checked) ──
    { label: 'Dashboard', path: '/admin/dashboard', icon: FiHome },
    { label: 'Messages', path: '/admin/enquiries', icon: FiMessageSquare },
    { label: 'Fees', path: '/admin/fees', icon: FiDollarSign },
    { label: 'Leaves', path: '/admin/leaves', icon: FiClock },
    { label: 'Announcements', path: '/admin/notices', icon: FiBell },
    // ── Daily attendance ──
    { label: 'Attendance', path: '/admin/attendance', icon: FiCheckSquare },
    { label: 'Staff Attendance', path: '/admin/staff-attendance', icon: FiUserCheck },
    // ── People ──
    { label: 'Students', path: '/admin/students', icon: FiUsers },
    { label: 'Parents', path: '/admin/parents', icon: FiUser },
    { label: 'Teachers', path: '/admin/teachers', icon: FiUser },
    // ── Academics ──
    { label: 'Classes', path: '/admin/classes', icon: FiLayers },
    { label: 'Subjects', path: '/admin/subjects', icon: FiBookOpen },
    { label: 'Exams', path: '/admin/exams', icon: FiClipboard },
    { label: 'Leaderboard', path: '/admin/leaderboard', icon: FiAward },
    { label: 'Timetable & Periods', path: '/admin/timetable', icon: FiCalendar },
    { label: 'Holidays', path: '/admin/holidays', icon: FiAward },
    // ── Operations ──
    { label: 'Expenses', path: '/admin/expenses', icon: FiCreditCard },
    { label: 'Transport', path: '/admin/transport', icon: FiTruck },
    // ── System ──
    { label: 'Settings', path: '/admin/settings', icon: FiSettings },
  ],
  [ROLES.TEACHER]: [
    { label: 'Dashboard', path: '/teacher/dashboard', icon: FiHome },
    { label: 'Messages', path: '/teacher/messages', icon: FiMessageSquare },
    { label: 'Attendance', path: '/teacher/attendance', icon: FiCheckSquare },
    { label: 'Timetable & Periods', path: '/teacher/timetable', icon: FiCalendar },
    { label: 'Holidays', path: '/teacher/holidays', icon: FiAward },
    { label: 'Daily Diary', path: '/teacher/diary', icon: FiBookOpen },
    { label: 'Exams', path: '/teacher/exams', icon: FiClipboard },
    { label: 'Results', path: '/teacher/results', icon: FiBarChart2 },
    { label: 'Leaderboard', path: '/teacher/leaderboard', icon: FiAward },
    { label: 'Notices', path: '/teacher/notices', icon: FiBell },
    { label: 'Leave', path: '/teacher/leave', icon: FiClock },
  ],
  [ROLES.STUDENT]: [
    { label: 'Dashboard', path: '/student/dashboard', icon: FiHome },
    { label: 'Timetable & Periods', path: '/student/timetable', icon: FiCalendar },
    { label: 'Holidays', path: '/student/holidays', icon: FiAward },
    { label: 'Daily Diary', path: '/student/diary', icon: FiBookOpen },
    { label: 'Exams', path: '/student/exams', icon: FiClipboard },
    { label: 'Results', path: '/student/results', icon: FiBarChart2 },
    { label: 'Attendance', path: '/student/attendance', icon: FiCheckSquare },
    { label: 'Analytics', path: '/student/analytics', icon: FiBarChart2 },
    { label: 'Leaderboard', path: '/student/leaderboard', icon: FiAward },
    { label: 'Leave', path: '/student/leave', icon: FiClock },
  ],
  [ROLES.PARENT]: [
    { label: 'Dashboard', path: '/parent/dashboard', icon: FiHome },
    { label: 'Messages', path: '/parent/messages', icon: FiMessageSquare },
    { label: 'Timetable & Periods', path: '/parent/timetable', icon: FiCalendar },
    { label: 'Holidays', path: '/parent/holidays', icon: FiAward },
    { label: 'Daily Diary', path: '/parent/diary', icon: FiBookOpen },
    { label: 'Results', path: '/parent/results', icon: FiBarChart2 },
    { label: 'Child Progress', path: '/parent/child-progress', icon: FiBarChart2 },
    { label: 'Fees', path: '/parent/fees', icon: FiDollarSign },
    { label: 'Transport', path: '/parent/transport', icon: FiTruck },
    { label: 'Notices', path: '/parent/notices', icon: FiBell },
    { label: 'Leave', path: '/parent/leave', icon: FiClock },
  ],
};

export const SUBSCRIPTION_PLANS = ['Free', 'Basic', 'Pro', 'Enterprise'];

export const STATUS_COLORS = {
  active: '#4ade80',
  inactive: '#f87171',
  pending: '#fbbf24',
  suspended: '#f97316',
};
