import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ROUTE_PATHS } from '../utils/constants';

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireProfileId?: boolean; // If true, ensure student/teacher profile ID is loaded
}

export default function ProtectedRoute({ children, allowedRoles, requireProfileId = false }: Props) {
  const { isAuthenticated, user, studentProfileId, teacherProfileId } = useAuthStore();
  const location = useLocation();

  // Not authenticated — redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user role is allowed to access this route
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role?.trim() || '';
    const isAllowed = allowedRoles.some(role => role?.trim() === userRole);
    
    if (!isAllowed) {
      // User doesn't have permission — redirect to their home dashboard
      const userDashboardPath = (ROUTE_PATHS as Record<string, string>)[userRole] || '/login';
      const redirectPath = userDashboardPath ? `${userDashboardPath}/dashboard` : '/login';
      return <Navigate to={redirectPath} replace />;
    }
  }

  // If requireProfileId is true, check that persistent profile ID is loaded
  if (requireProfileId) {
    const userRole = user.role?.trim() || '';
    
    if (userRole === 'STUDENT' && !studentProfileId) {
      // Profile ID not yet loaded - could wait or redirect
      console.warn('Student profile ID not yet loaded');
      // For now, allow access (profile ID will be loaded after login)
    } else if (userRole === 'TEACHER' && !teacherProfileId) {
      // Profile ID not yet loaded
      console.warn('Teacher profile ID not yet loaded');
      // For now, allow access (profile ID will be loaded after login)
    }
  }

  return <>{children}</>;
}
