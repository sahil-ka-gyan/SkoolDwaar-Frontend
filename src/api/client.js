import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/* ── Request interceptor: attach JWT ── */
client.interceptors.request.use(
  (config) => {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        /* ignore parse errors */
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response interceptor: handle 401 ── */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const raw = localStorage.getItem('auth-storage');
        const parsed = raw ? JSON.parse(raw) : null;
        const refresh = parsed?.state?.refreshToken;

        if (!refresh) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refresh,
        });

        const newToken = data.access_token;
        const newRefresh = data.refresh_token || refresh;

        /* Update zustand persisted store */
        const updated = {
          ...parsed,
          state: { ...parsed.state, token: newToken, refreshToken: newRefresh },
        };
        localStorage.setItem('auth-storage', JSON.stringify(updated));

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
