import client from './client';


export const getUsers = (params = {}) =>
  client.get('/users', { params }).then((r) => r.data);

export const getUser = (userId) =>
  client.get(`/users/${userId}`).then((r) => r.data);

export const createUser = (payload) =>
  client.post('/users', payload).then((r) => r.data);

export const updateUser = (userId, payload) =>
  client.patch(`/users/${userId}`, payload).then((r) => r.data);

export const updateStaffProfile = (userId, centerId, payload) =>
  client.patch(`/users/${userId}/center/${centerId}/staff_profile`, payload).then((r) => r.data);

export const removeUserFromCenter = (userId, centerId) =>
  client.delete(`/users/${userId}/center/${centerId}`).then((r) => r.data);

export async function getStudents(params = {}) {
  const { role = 'student', search = '', page = 1, perPage = 100 } = params;
  
  const query = new URLSearchParams({
    role,
    page,
    per_page: perPage,
  });

  if (search) {
    query.append('search', search);
  }

  const res = await client.get(`/users?${query.toString()}`);
  return res.data;
}
