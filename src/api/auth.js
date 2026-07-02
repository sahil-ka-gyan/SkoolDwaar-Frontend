import client from './client';

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password });
  return data;
}

export async function refreshToken(refresh) {
  const { data } = await client.post('/auth/refresh', { refresh_token: refresh });
  return data;
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data;
}

export async function forgotPassword(email) {
  const { data } = await client.post('/auth/forgot-password', { email });
  return data;
}

export async function verifyOtp(email, otp) {
  const { data } = await client.post('/auth/verify-otp', { email, otp });
  return data; // { reset_token, expires_in_minutes }
}

export async function resetPassword(reset_token, new_password) {
  const { data } = await client.post('/auth/reset-password', { reset_token, new_password });
  return data;
}
