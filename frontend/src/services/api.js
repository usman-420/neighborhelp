// services/api.js — one configured Axios instance for the whole app.

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Request interceptor: attach the token to every outgoing request, so
// no component has to remember to do it.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: log the user out ONLY when a 401 is about the
// token itself.
//
// Not every 401 means "your session died". The change-password endpoint
// returns 401 for "your current password is wrong" — treating that as an
// expired session would throw the user out for a typo. The backend tags
// token failures with code TOKEN_MISSING / TOKEN_INVALID, and only those
// clear the session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isTokenProblem =
      error.response?.status === 401 &&
      String(error.response?.data?.code || '').startsWith('TOKEN');

    if (isTokenProblem) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
