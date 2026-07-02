/**
 * Persistent ID Utilities
 * 
 * Helper functions for working with persistent IDs in the system.
 * Persistent IDs are UUIDs that never change for students, teachers, and admins.
 */

import { useAuthStore } from '../stores/authStore';
import { getMyStudentProfile } from '../api/students';
import { getMyTeacherProfile } from '../api/teachers';

/**
 * Validate that a string is a valid UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Load and store the persistent profile ID for the current user
 * Should be called after login
 */
export async function loadPersistentProfileId(): Promise<string | null> {
  const { user, setStudentProfileId, setTeacherProfileId } = useAuthStore.getState();
  
  if (!user) {
    console.warn('No user logged in');
    return null;
  }

  try {
    if (user.role === 'STUDENT') {
      const profile = await getMyStudentProfile();
      if (profile?.id) {
        setStudentProfileId(profile.id);
        return profile.id;
      }
    } else if (user.role === 'TEACHER') {
      const profile = await getMyTeacherProfile();
      if (profile?.id) {
        setTeacherProfileId(profile.id);
        return profile.id;
      }
    }
  } catch (err) {
    console.error('Error loading persistent profile ID:', err);
  }

  // For admins, return the user ID
  if (user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN') {
    return user.id;
  }

  return null;
}

/**
 * Format a UUID for display (shortened version)
 * Example: "550e8400-e29b-41d4-a716-446655440000" → "550e8400...440000"
 */
export function formatUUIDShort(uuid: string): string {
  if (!uuid || uuid.length < 20) {
    return uuid;
  }
  return `${uuid.substring(0, 8)}...${uuid.substring(uuid.length - 6)}`;
}

/**
 * Get a description of what the ID represents based on user role
 */
export function getIdDescription(role: string): string {
  switch (role) {
    case 'STUDENT':
      return 'Persistent Student Profile ID (never changes even when promoted)';
    case 'TEACHER':
      return 'Persistent Teacher Profile ID (never changes even when reassigned)';
    case 'SCHOOL_ADMIN':
    case 'SUPER_ADMIN':
      return 'Persistent Admin Account ID (never changes)';
    default:
      return 'Persistent User ID';
  }
}

/**
 * Compare two user IDs safely (handles null/undefined)
 */
export function areSameUser(id1: string | null | undefined, id2: string | null | undefined): boolean {
  if (!id1 || !id2) return false;
  return id1 === id2;
}

/**
 * Extract school ID from auth context
 */
export function getCurrentSchoolId(): string | null {
  return useAuthStore.getState().user?.school_id || null;
}

/**
 * Check if user is the same person (comparing persistent IDs)
 */
export function isSameStudent(persistentId: string | null | undefined): boolean {
  const { studentProfileId } = useAuthStore.getState();
  return areSameUser(persistentId, studentProfileId);
}

/**
 * Check if user is the same teacher
 */
export function isSameTeacher(persistentId: string | null | undefined): boolean {
  const { teacherProfileId } = useAuthStore.getState();
  return areSameUser(persistentId, teacherProfileId);
}

/**
 * Check if user is the same admin
 */
export function isSameAdmin(userId: string | null | undefined): boolean {
  const { user } = useAuthStore.getState();
  return areSameUser(userId, user?.id);
}
