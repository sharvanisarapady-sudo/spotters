import api from './api';

export const systemService = {
  list: () => api.get('/systems').then((r) => r.data),
};
