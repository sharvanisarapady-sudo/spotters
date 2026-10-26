import api from './api';

export const practiceService = {
  getCasesBySystem: (slug) => api.get(`/practice/systems/${slug}/cases`).then((r) => r.data),
  getCase: (id) => api.get(`/practice/cases/${id}`).then((r) => r.data),
};

export const bookmarkService = {
  add: (caseId) => api.post(`/bookmarks/${caseId}`).then((r) => r.data),
  remove: (caseId) => api.delete(`/bookmarks/${caseId}`).then((r) => r.data),
  list: () => api.get('/bookmarks').then((r) => r.data),
};
