import client from './client';

export const getUsers = (params = {}) =>
  client.get('/users', { params }).then((r) => r.data);

export const getUser = (userId) =>
  client.get(`/users/${userId}`).then((r) => r.data);

export const createUser = (payload) =>
  client.post('/users', payload).then((r) => r.data);

export const updateUser = (userId, payload) =>
  client.patch(`/users/${userId}`, payload).then((r) => r.data);
