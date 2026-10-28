import api from './api';

export const dashboardService = {
  get: () => api.get('/dashboard').then((r) => r.data),
  addPlannerTask: (data) => api.post('/dashboard/planner', data).then((r) => r.data),
  togglePlannerTask: (id) => api.patch(`/dashboard/planner/${id}/toggle`).then((r) => r.data),
  deletePlannerTask: (id) => api.delete(`/dashboard/planner/${id}`).then((r) => r.data),
};
