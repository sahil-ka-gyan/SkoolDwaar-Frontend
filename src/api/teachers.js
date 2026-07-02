import client from './client';

/**
 * Fetch current logged-in user's teacher profile (if user is a teacher)
 * Returns the persistent TeacherProfile.id which never changes
 */
export async function getMyTeacherProfile() {
  try {
    const { data } = await client.get('/teachers/me');
    return data;
  } catch (err) {
    // Not a teacher - 404 is expected for non-teachers
    if (err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Get all teachers with pagination
 */
export async function getTeachers(params = {}) {
  const { data } = await client.get('/teachers', { params });
  return data;
}

/**
 * Get a specific teacher by their persistent ID
 */
export async function getTeacher(id) {
  const { data } = await client.get(`/teachers/${id}`);
  return data;
}

/**
 * Create a new teacher
 */
export async function createTeacher(payload) {
  const { data } = await client.post('/teachers', payload);
  return data;
}

/**
 * Update a teacher (by persistent ID)
 * Note: The persistent ID never changes, but other fields like department, employee_id can be updated
 */
export async function updateTeacher(id, payload) {
  const { data } = await client.put(`/teachers/${id}`, payload);
  return data;
}

/**
 * Delete a teacher
 */
export async function deleteTeacher(id) {
  const { data } = await client.delete(`/teachers/${id}`);
  return data;
}
