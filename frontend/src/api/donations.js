import client from './client';

export async function getDonations(params = {}) {
  const { data } = await client.get('/donations', { params });
  return data;
}

export async function recordDonation(payload) {
  const { data } = await client.post('/donations', payload);
  return data;
}
