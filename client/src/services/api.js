import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send/receive the httpOnly auth cookie
  headers: { 'Content-Type': 'application/json' },
});

// Expired/invalid session on a protected call -> back to login.
// (The initial /auth/me probe and login/register 401s are expected, so they're ignored.)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/');
    const onPublicPage = ['/', '/login', '/register'].includes(window.location.pathname);
    if (err.response?.status === 401 && !isAuthCall && !onPublicPage) {
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
