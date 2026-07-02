import client from './client';

/**
 * Fetch current logged-in user's student profile (if user is a student)
 * Returns the persistent StudentProfile.id which never changes
 */
export async function getMyStudentProfile() {
  try {
    const { data } = await client.get('/students/me');
    return data;
  } catch (err) {
    // Not a student - 404 is expected for non-students
    if (err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Get all students with pagination
 */
export async function getStudents(params = {}) {
  const { data } = await client.get('/students', { params });
  return data;
}

/**
 * Get a specific student by their persistent ID
 */
export async function getStudent(id) {
  const { data } = await client.get(`/students/${id}`);
  return data;
}

/**
 * Create a new student
 */
export async function createStudent(payload) {
  const { data } = await client.post('/students', payload);
  return data;
}

/**
 * Update a student (by persistent ID)
 * Note: The persistent ID never changes, but other fields like roll_no, section_id can change
 */
export async function updateStudent(id, payload) {
  const { data } = await client.put(`/students/${id}`, payload);
  return data;
}

/**
 * Delete a student
 */
export async function deleteStudent(id) {
  const { data } = await client.delete(`/students/${id}`);
  return data;
}
