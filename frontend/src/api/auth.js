import client from './client';

export async function signIn({ phone, password }) {
  const { data } = await client.post('/auth/signin', { phone, password });
  return data;
}

export async function signUp(payload) {
  const { data } = await client.post('/auth/signup', payload);
  return data;
}

export async function refreshToken(token) {
  const { data } = await client.post('/auth/refresh', { refresh_token: token });
  return data;
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data;
}
