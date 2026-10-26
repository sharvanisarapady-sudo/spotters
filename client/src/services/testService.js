import api from './api';

export const testService = {
  listBlocks: () => api.get('/tests').then((r) => r.data),
  start: (testId) => api.post(`/tests/${testId}/start`).then((r) => r.data),
  submitAnswer: (attemptId, payload) =>
    api.post(`/tests/attempts/${attemptId}/answers`, payload).then((r) => r.data),
  complete: (attemptId) => api.post(`/tests/attempts/${attemptId}/complete`).then((r) => r.data),
  getResults: (attemptId) => api.get(`/tests/attempts/${attemptId}/results`).then((r) => r.data),
};
