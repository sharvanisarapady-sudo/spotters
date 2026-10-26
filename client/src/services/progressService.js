import api from './api';

export const progressService = {
  get: () => api.get('/progress').then((r) => r.data),
};
