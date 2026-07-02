import client from './client';

export async function getSchools(params = {}) {
  const { data } = await client.get('/schools', { params });
  return data;
}

export async function getSchool(id) {
  const { data } = await client.get(`/schools/${id}`);
  return data;
}

export async function createSchool(payload) {
  const { data } = await client.post('/schools', payload);
  return data;
}

export async function updateSchool(id, payload) {
  const { data } = await client.put(`/schools/${id}`, payload);
  return data;
}

export async function deleteSchool(id) {
  const { data } = await client.delete(`/schools/${id}`);
  return data;
}
