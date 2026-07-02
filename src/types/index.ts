/**
 * Persistent ID System Documentation
 * 
 * This file defines TypeScript interfaces for the persistent ID system.
 * 
 * Key Principles:
 * - Each student has a unique `id` (UUID) that NEVER changes
 * - Each teacher has a unique `id` (UUID) that NEVER changes  
 * - Each admin has a unique `id` (UUID) that NEVER changes
 * 
 * These IDs persist across:
 * - Class promotions (for students)
 * - Department changes (for teachers)
 * - Role changes (for admins)
 * - Section/assignment changes
 * 
 * Use these IDs for any historical tracking or long-term references.
 */

/**
 * Persistent ID interface - all entities that need permanent tracking
 */
export interface HasPersistentId {
  /** Unique UUID that NEVER changes - use this for permanent identification */
  id: string;
  created_at: string;
  updated_at?: string;
}

/**
 * User model - for admins, teachers, students, parents
 */
export interface User extends HasPersistentId {
  /** Persistent unique ID (UUID) - never changes */
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  /** Role: SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT, PARENT */
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  school_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * School Admin - extends User with role SCHOOL_ADMIN
 */
export interface SchoolAdmin extends User {
  role: 'SCHOOL_ADMIN';
  school_id: string; // Not null for school admins
}

/**
 * Student Profile - separate from User
 */
export interface StudentProfile extends HasPersistentId {
  /** Persistent unique ID (UUID) - NEVER changes even when student is promoted */
  id: string;
  
  /** School-unique admission number - doesn't change */
  admission_no: string;
  
  /** Current roll number - CHANGES when student moves to different class/section */
  roll_no?: string;
  
  /** Reference to User account */
  user_id: string;
  school_id: string;
  section_id?: string;
  
  dob?: string;
  blood_group?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Teacher Profile - separate from User
 */
export interface TeacherProfile extends HasPersistentId {
  /** Persistent unique ID (UUID) - NEVER changes even when teacher changes department */
  id: string;
  
  /** School-unique employee ID - should rarely change */
  employee_id: string;
  
  /** Reference to User account */
  user_id: string;
  school_id: string;
  
  qualification?: string;
  department?: string;
  phone?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Student data with both User and Profile information
 */
export interface StudentData {
  user: User;
  profile: StudentProfile;
}

/**
 * Teacher data with both User and Profile information
 */
export interface TeacherData {
  user: User;
  profile: TeacherProfile;
}
