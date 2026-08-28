import client from './client';


export const getUsers = (params = {}) =>
  client.get('/users', { params }).then((r) => r.data);

export const getUser = (userId) =>
  client.get(`/users/${userId}`).then((r) => r.data);

export const createUser = (payload) =>
  client.post('/users', payload).then((r) => r.data);

export const updateUser = (userId, payload) =>
  client.patch(`/users/${userId}`, payload).then((r) => r.data);

export const updateProfile = (userId, formData) =>
  client.patch(`/users/${userId}/profile`, formData).then((r) => r.data);

export const changePassword = (userId, payload) =>
  client.post(`/users/${userId}/change-password`, payload).then((r) => r.data);

export const updateStaffProfile = (userId, centerId, payload) =>
  client.patch(`/users/${userId}/center/${centerId}/staff_profile`, payload).then((r) => r.data);

export const removeUserFromCenter = (userId, centerId) =>
  client.delete(`/users/${userId}/center/${centerId}`).then((r) => r.data);

export async function getStudents(params = {}) {
  const { role = 'student', search = '', page = 1, perPage = 100, center_id } = params;
  
  const query = new URLSearchParams({
    role,
    page,
    per_page: perPage,
  });

  if (search) {
    query.append('search', search);
  }
  if (center_id) {
    query.append('center_id', center_id);
  }

  const res = await client.get(`/users?${query.toString()}`);
  return res.data;
}

export async function exportStudents({ center_id, format = 'xlsx' } = {}) {
  const params = { format };
  if (center_id && center_id !== 'all') {
    params.center_id = center_id;
  }
  const response = await client.get('/users/export/students', {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream',
  });

  const contentDisposition = response.headers['content-disposition'];
  let filename = `students_export.${format}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
}


export async function importStudents(formData) {
  const { data } = await client.post('/users/import/students', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function downloadImportTemplate(format = 'csv') {
  const response = await client.get('/users/import/template', {
    params: { format },
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'text/csv',
  });

  const filename = `sample_student_import_template.${format}`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
}
