import client from './client';

export async function getStaffDetails(centerId) {
  const { data } = await client.get(`/centers/${centerId}/salaries/staff`);
  return data;
}

export async function updateBaseSalary(centerId, staffUserId, baseSalary) {
  const { data } = await client.put(`/centers/${centerId}/salaries/staff/${staffUserId}`, {
    base_salary: baseSalary,
  });
  return data;
}

export async function recordSalaryPayment(centerId, paymentData) {
  const { data } = await client.post(`/centers/${centerId}/salaries/pay`, paymentData);
  return data;
}

export async function getSalaryPayments(centerId, params = {}) {
  const { data } = await client.get(`/centers/${centerId}/salaries/payments`, { params });
  return data;
}
