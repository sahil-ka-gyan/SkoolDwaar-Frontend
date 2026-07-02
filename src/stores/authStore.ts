import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, StudentProfile, TeacherProfile } from '../types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  
  /** Persistent ID for students (from StudentProfile.id) */
  studentProfileId: string | null;
  
  /** Persistent ID for teachers (from TeacherProfile.id) */
  teacherProfileId: string | null;
  
  isAuthenticated: boolean;
  
  setAuth: (token: string, refreshToken: string, user: User) => void;
  setUser: (user: User) => void;
  setStudentProfileId: (id: string | null) => void;
  setTeacherProfileId: (id: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      studentProfileId: null,
      teacherProfileId: null,
      isAuthenticated: false,
      
      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),
      
      setUser: (user) => set({ user }),
      
      /** Store persistent student profile ID (never changes) */
      setStudentProfileId: (id) => set({ studentProfileId: id }),
      
      /** Store persistent teacher profile ID (never changes) */
      setTeacherProfileId: (id) => set({ teacherProfileId: id }),
      
      logout: () =>
        set({ 
          token: null, 
          refreshToken: null, 
          user: null, 
          studentProfileId: null,
          teacherProfileId: null,
          isAuthenticated: false 
        }),
    }),
    { name: 'auth-storage' }
  )
);

