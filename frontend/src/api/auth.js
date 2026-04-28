import client from './client';

export async function login({ phone, password }) {
  const { data } = await client.post('/auth/login', { phone, password });
  return data; // { access_token, refresh_token, user }
}

export async function refresh() {
  // refresh_token is in an httpOnly cookie — sent automatically via withCredentials.
  const { data } = await client.post('/auth/refresh', {});
  return data; // { access_token }
}

export async function logout() {
  await client.post('/auth/logout', {});
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data;
}

export async function changePassword({ current_password, new_password }) {
  const { data } = await client.post('/auth/change-password', { current_password, new_password });
  return data;
}
