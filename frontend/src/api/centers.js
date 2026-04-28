import client from './client';

export async function listCenters(params = {}) {
  const { data } = await client.get('/centers', { params });
  return data;
}

export async function getCenter(id) {
  const { data } = await client.get(`/centers/${id}`);
  return data;
}

export async function createCenter(payload) {
  const { data } = await client.post('/centers', payload);
  return data;
}

export async function updateCenter(id, payload) {
  const { data } = await client.patch(`/centers/${id}`, payload);
  return data;
}
