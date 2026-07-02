# Frontend Persistent ID System Documentation

## Overview

The frontend now supports the persistent ID system where:
- **Students** have a unique `StudentProfile.id` that never changes (even when promoted)
- **Teachers** have a unique `TeacherProfile.id` that never changes (even when reassigned)
- **Admins** have a unique `User.id` that never changes

## Type Definitions

All types are defined in `src/types/index.ts`:

```typescript
// Student profile with persistent ID
interface StudentProfile extends HasPersistentId {
  id: string;              // ← Persistent ID (never changes)
  admission_no: string;    // ← School-unique (never changes)
  roll_no?: string;        // ← Changes with class promotion
  user_id: string;
  school_id: string;
  section_id?: string;     // ← Changes with class/section change
  dob?: string;
  blood_group?: string;
}

// Teacher profile with persistent ID
interface TeacherProfile extends HasPersistentId {
  id: string;              // ← Persistent ID (never changes)
  employee_id: string;     // ← School-unique employee ID
  user_id: string;
  school_id: string;
  qualification?: string;
  department?: string;     // ← Can change
  phone?: string;
}
```

## Auth Store Updates

The `authStore` now tracks persistent IDs:

```typescript
interface AuthState {
  user: User | null;
  
  // Persistent IDs - store these for long-term reference
  studentProfileId: string | null;      // ← For students only
  teacherProfileId: string | null;      // ← For teachers only
  
  setStudentProfileId: (id: string | null) => void;
  setTeacherProfileId: (id: string | null) => void;
}
```

## Hooks for Accessing Persistent IDs

### `usePersistentId()`
Returns the current user's persistent ID (works for all roles):

```typescript
import { usePersistentId } from '../hooks/usePersistentId';

function MyComponent() {
  const persistentId = usePersistentId();
  
  return <div>Your ID: {persistentId}</div>;
}
```

### `useStudentProfile()`
Returns information about student profile:

```typescript
import { useStudentProfile } from '../hooks/usePersistentId';

function StudentDashboard() {
  const { isStudent, profileId, userId } = useStudentProfile();
  
  if (!isStudent) return <div>Not a student</div>;
  
  return (
    <div>
      <p>Persistent Profile ID: {profileId}</p>
      <p>User Account ID: {userId}</p>
    </div>
  );
}
```

### `useTeacherProfile()`
Returns information about teacher profile:

```typescript
import { useTeacherProfile } from '../hooks/usePersistentId';

function TeacherDashboard() {
  const { isTeacher, profileId, userId } = useTeacherProfile();
  
  if (!isTeacher) return <div>Not a teacher</div>;
  
  return (
    <div>
      <p>Persistent Profile ID: {profileId}</p>
      <p>User Account ID: {userId}</p>
    </div>
  );
}
```

### `useAdminProfile()`
Returns information about admin:

```typescript
import { useAdminProfile } from '../hooks/usePersistentId';

function AdminPanel() {
  const { isAdmin, isSuperAdmin, adminId } = useAdminProfile();
  
  return (
    <div>
      <p>Admin ID: {adminId}</p>
      <p>Super Admin: {isSuperAdmin ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### `usePersistentIdReady()`
Check if persistent ID is loaded:

```typescript
import { usePersistentIdReady } from '../hooks/usePersistentId';

function MyComponent() {
  const isReady = usePersistentIdReady();
  
  if (!isReady) return <div>Loading profile...</div>;
  
  return <div>Profile loaded!</div>;
}
```

## API Functions

### Students API (`src/api/students.js`)

```typescript
// Fetch current logged-in user's student profile
const profile = await getMyStudentProfile();
// Returns: { id: "uuid", admission_no: "2025001", roll_no: "01", ... }

// Get a specific student
const student = await getStudent(persistentId);

// Create a new student
const newStudent = await createStudent({
  email: "student@school.com",
  first_name: "John",
  admission_no: "2025010",
  section_id: "section-uuid"
});

// Update a student (can change roll_no, section_id, etc. but not id)
const updated = await updateStudent(persistentId, {
  roll_no: "02",
  section_id: "new-section-uuid"
});

// Delete a student
await deleteStudent(persistentId);
```

### Teachers API (`src/api/teachers.js`)

```typescript
// Fetch current logged-in user's teacher profile
const profile = await getMyTeacherProfile();
// Returns: { id: "uuid", employee_id: "T001", department: "Math", ... }

// Get a specific teacher
const teacher = await getTeacher(persistentId);

// Create a new teacher
const newTeacher = await createTeacher({
  email: "teacher@school.com",
  first_name: "Jane",
  employee_id: "T010",
  department: "Science"
});

// Update a teacher (can change department, but not id)
const updated = await updateTeacher(persistentId, {
  department: "Mathematics"
});

// Delete a teacher
await deleteTeacher(persistentId);
```

## Login Flow with Persistent ID

The login process now:

1. User enters credentials
2. Backend authenticates and returns JWT + User data
3. Frontend stores User data in auth store
4. Frontend fetches StudentProfile or TeacherProfile based on role
5. Frontend stores the persistent ID (studentProfileId or teacherProfileId) in auth store
6. All three IDs are persisted in localStorage

```typescript
// After login, the auth store contains:
{
  user: { id: "user-uuid", role: "STUDENT", ... },
  studentProfileId: "profile-uuid",  // ← Persistent ID for tracking
  token: "jwt-token",
  isAuthenticated: true
}
```

## Using Persistent IDs in Components

### Display Student's Persistent ID

```typescript
function StudentCard() {
  const { profileId } = useStudentProfile();
  
  return (
    <div>
      <h3>Student Profile</h3>
      <p>Persistent ID: <code>{profileId}</code></p>
      <p>This ID never changes, even when you get promoted!</p>
    </div>
  );
}
```

### Track Student Progress Using Persistent ID

```typescript
async function getStudentHistory(studentPersistentId: string) {
  // Query backend API to get all historical records for this student
  const response = await fetch(
    `/api/v1/students/${studentPersistentId}/history`
  );
  const history = await response.json();
  return history;
}
```

### Update Student Class Without Losing ID

```typescript
async function promoteStudent(studentPersistentId: string, newSectionId: string) {
  // Update the student's section and roll_no
  const updated = await updateStudent(studentPersistentId, {
    section_id: newSectionId,
    roll_no: "01"  // Reset roll number for new class
  });
  
  // The persistent ID (studentPersistentId) remains unchanged!
  return updated;
}
```

## Best Practices

### ✅ DO: Use Persistent ID for Long-term References

```typescript
// Good: Store persistent ID for tracking
const persistentId = usePersistentId();
localStorage.setItem('myStudentId', persistentId);
```

### ✅ DO: Use Persistent ID to Query Historical Data

```typescript
// Good: Query history using persistent ID
const history = await fetch(`/api/v1/students/${persistentId}/history`);
```

### ❌ DON'T: Use roll_no as Permanent Identifier

```typescript
// Bad: roll_no changes when student moves to different class
const rollNo = student.roll_no;
localStorage.setItem('myId', rollNo); // Wrong!
```

### ❌ DON'T: Assume admission_no is Globally Unique

```typescript
// Bad: admission_no is only unique per school
const admissionNo = student.admission_no;
const queryString = `?id=${admissionNo}`;  // Unsafe!
```

### ✅ DO: Always Use Persistent ID for API Calls

```typescript
// Good: Use persistent ID
const student = await getStudent(persistentId);

// Bad: Using roll_no or other temporary fields
const student = await getStudent(student.roll_no);
```

## Database Lookups

When querying for a student or teacher:

| Field | Use Case | Unique Scope |
|-------|----------|--------------|
| `id` | Persistent tracking, historical records | Global (across all schools) |
| `user_id` | Link to User account | Global |
| `admission_no` | School enrollment | Per school |
| `roll_no` | Current class position | Per section (changes) |
| `employee_id` | School employment | Per school |
| `department` | Current assignment | Per school (can change) |

## Migration from Old System

If you have existing code using `roll_no` or other temporary fields:

```typescript
// Old approach (DON'T DO THIS)
const student = students.find(s => s.roll_no === '01');

// New approach (DO THIS)
const student = students.find(s => s.id === persistentId);
```

## Storage

Persistent IDs are automatically stored in localStorage by Zustand:

```typescript
// In browser console, view stored auth data:
JSON.parse(localStorage.getItem('auth-storage'))

// Output:
{
  state: {
    user: { id: "user-uuid", role: "STUDENT", ... },
    studentProfileId: "profile-uuid",  // ← Persistent ID
    token: "jwt-token",
    isAuthenticated: true
  }
}
```

## Debugging

To check persistent IDs:

```typescript
import { useAuthStore } from '../stores/authStore';

function DebugIds() {
  const { user, studentProfileId, teacherProfileId } = useAuthStore();
  
  console.log('User ID:', user?.id);
  console.log('Student Profile ID:', studentProfileId);
  console.log('Teacher Profile ID:', teacherProfileId);
  
  return null;
}
```

## Summary

- **Persistent IDs** (`id` field) are UUIDs that never change
- They are stored in auth store when user logs in
- Use hooks like `usePersistentId()` to access them
- Always use persistent IDs for tracking and historical queries
- Don't rely on `roll_no`, `section_id`, or `department` for permanent identification
