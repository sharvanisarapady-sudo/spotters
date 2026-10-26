import api from './api';

export const navigationAiService = {
  listCases: () => api.get('/navigation-ai/cases').then((r) => r.data),
  getCase: (id) => api.get(`/navigation-ai/cases/${id}`).then((r) => r.data),
  analyze: (id, answer, inputMethod) =>
    api.post(`/navigation-ai/cases/${id}/analyze`, { answer, inputMethod }, { timeout: 60000 }).then((r) => r.data),
};
