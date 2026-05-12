import client from './client';

/**
 * Fetch paginated activity log for a specific center.
 * @param {string} centerId
 * @param {{ limit?, offset?, action?, actor_user_id? }} params
 */
export const getCenterActivity = (centerId, params = {}) =>
  client.get(`/centers/${centerId}/activity`, { params }).then((r) => r.data);

/**
 * Fetch org-wide activity log (super_admin only).
 * @param {{ limit?, offset?, action?, actor_user_id? }} params
 */
export const getOrgActivity = (params = {}) =>
  client.get('/activity', { params }).then((r) => r.data);
