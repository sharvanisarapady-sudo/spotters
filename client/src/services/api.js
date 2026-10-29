import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 45000,
  withCredentials: true, // send/receive the httpOnly auth cookie
  headers: { 'Content-Type': 'application/json' },
});

// Fast in-memory GET response cache so switching tabs (Dashboard, Practice, Tests, AI Mentor) is instant.
// Any POST / PUT / PATCH / DELETE automatically invalidates cached GET responses so data is never stale.
const getCache = new Map();
const CACHEABLE_PREFIXES = [
  '/systems',
  '/tests',
  '/practice/',
  '/navigation-ai/cases',
  '/dashboard',
  '/progress',
];

function isCacheableGet(url = '') {
  if (url.includes('/attempts/')) return false;
  return CACHEABLE_PREFIXES.some((p) => url.startsWith(p));
}

const origGet = api.get.bind(api);
api.get = function cachedGet(url, config) {
  if (!config?.params && isCacheableGet(url)) {
    const entry = getCache.get(url);
    if (entry && entry.expiresAt > Date.now()) {
      return Promise.resolve(entry.response);
    }
  }
  return origGet(url, config).then((res) => {
    if (!config?.params && isCacheableGet(url)) {
      const ttl = url.startsWith('/dashboard') || url.startsWith('/progress') ? 20000 : 90000;
      getCache.set(url, { response: res, expiresAt: Date.now() + ttl });
    }
    return res;
  });
};

// Clear client GET cache on any state-mutating request
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && !(config.url || '').startsWith('/health')) {
    getCache.clear();
  }
  return config;
});

// Automatic retry on transient cloud gateway / wake-up errors (502, 503, 504, network hiccup)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err.config || {};
    const status = err.response?.status;
    const method = (cfg.method || 'get').toLowerCase();
    const isTransient = !err.response || status === 502 || status === 503 || status === 504;

    if (isTransient && !cfg._retried && (method === 'get' || (cfg.url || '').includes('/complete'))) {
      cfg._retried = true;
      await new Promise((r) => setTimeout(r, 1200));
      return api(cfg);
    }

    const url = cfg.url || '';
    const isAuthCall = url.startsWith('/auth/');
    const onPublicPage = ['/', '/login', '/register'].includes(window.location.pathname);
    if (status === 401 && !isAuthCall && !onPublicPage) {
      getCache.clear();
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
