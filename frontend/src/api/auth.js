import client from './client';

export async function login({ phone, password }) {
  const { data } = await client.post('/auth/login', { phone, password });
  return data; // { access_token, refresh_token, user }
}

export async function refresh() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token available');
  const { data } = await client.post('/auth/refresh', { refresh_token: refreshToken });
  return data; // { access_token }
}

export async function logout() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    await client.post('/auth/logout', { refresh_token: refreshToken });
  }
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data;
}

export async function changePassword({ current_password, new_password }) {
  const { data } = await client.post('/auth/change-password', { current_password, new_password });
  return data;
}

// Public — no auth required
export async function signup({ full_name, full_name_ur, phone, password, center_id }) {
  const { data } = await client.post('/auth/signup', { full_name, full_name_ur, phone, password, center_id });
  return data; // { access_token, refresh_token, user }
}

export async function getPublicCenters() {
  const { data } = await client.get('/auth/centers');
  return data; // [{ id, name, name_ur, city }]
}
