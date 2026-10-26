
import api from './api';

export const adminService = {
  // Cases
  listCases: (params) =>
    api.get('/admin/cases', { params }).then((r) => r.data),

  getCase: (id) =>
    api.get(`/admin/cases/${id}`).then((r) => r.data),

  createCase: (data) =>
    api.post('/admin/cases', data).then((r) => r.data),

  updateCase: (id, data) =>
    api.put(`/admin/cases/${id}`, data).then((r) => r.data),

  setStatus: (id, status) =>
    api.patch(`/admin/cases/${id}/status`, { status }).then((r) => r.data),

  // Radiology systems
  listSystems: () =>
    api.get('/systems').then((r) => r.data),

  // Images
  deleteImage: (imageId) =>
    api.delete(`/admin/images/${imageId}`).then((r) => r.data),

  /**
   * Uploads one or more image files to a case.
   * onProgress(percent) is optional.
   */
  uploadImages: (caseId, files, onProgress) => {
    const form = new FormData();

    files.forEach((file) => form.append('images', file));

    return api
      .post(`/admin/cases/${caseId}/images/upload`, form, {
        headers: { 'Content-Type': undefined },
        timeout: 120000,
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(
              Math.round((event.loaded / event.total) * 100)
            );
          }
        },
      })
      .then((r) => r.data);
  },

  // Test blocks
  listTests: () =>
    api.get('/admin/tests').then((r) => r.data),

  addTestQuestion: (testId, caseId) =>
    api.post(`/admin/tests/${testId}/questions/add`, { caseId })
      .then((r) => r.data),

  removeTestQuestion: (testId, questionId) =>
    api.delete(`/admin/tests/${testId}/questions/${questionId}`)
      .then((r) => r.data),
};

