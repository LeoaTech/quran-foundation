import client from './client';

export async function getDonations(centerId, params = {}) {
  const { data } = await client.get(`/donations/centers/${centerId}`, { params });
  return data;
}

export async function recordDonation(centerId, payload) {
  const { data } = await client.post(`/donations/centers/${centerId}`, payload);
  return data;
}
