import { useAuthStore } from '../stores/authStore';

/**
 * Hook to get the current user's persistent ID
 * 
 * For Students: Returns StudentProfile.id (never changes even when promoted)
 * For Teachers: Returns TeacherProfile.id (never changes even when reassigned)
 * For Admins: Returns User.id (never changes)
 * 
 * @returns The persistent ID or null if not logged in
 */
export function usePersistentId(): string | null {
  const { user, studentProfileId, teacherProfileId } = useAuthStore();

  if (!user) return null;

  // For students, return the student profile ID
  if (user.role === 'STUDENT') {
    return studentProfileId || null;
  }

  // For teachers, return the teacher profile ID
  if (user.role === 'TEACHER') {
    return teacherProfileId || null;
  }

  // For admins (SCHOOL_ADMIN, SUPER_ADMIN), return the user ID
  return user.id;
}

/**
 * Hook to get information about whether the user is a student and their profile ID
 */
export function useStudentProfile() {
  const { user, studentProfileId } = useAuthStore();
  
  return {
    isStudent: user?.role === 'STUDENT',
    profileId: studentProfileId,
    userId: user?.id,
  };
}

/**
 * Hook to get information about whether the user is a teacher and their profile ID
 */
export function useTeacherProfile() {
  const { user, teacherProfileId } = useAuthStore();
  
  return {
    isTeacher: user?.role === 'TEACHER',
    profileId: teacherProfileId,
    userId: user?.id,
  };
}

/**
 * Hook to get information about whether the user is an admin
 */
export function useAdminProfile() {
  const { user } = useAuthStore();
  
  return {
    isAdmin: user?.role === 'SCHOOL_ADMIN',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    adminId: user?.id,
  };
}

/**
 * Hook to check if the user has their persistent ID loaded
 */
export function usePersistentIdReady(): boolean {
  const { user, studentProfileId, teacherProfileId } = useAuthStore();

  if (!user) return false;

  if (user.role === 'STUDENT') {
    return !!studentProfileId;
  }

  if (user.role === 'TEACHER') {
    return !!teacherProfileId;
  }

  // Admins don't need separate profile IDs
  return true;
}
