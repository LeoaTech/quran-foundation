const db = require('../db/knex');

/**
 * Insert a single activity log row.
 * @param {object} data
 */
async function insertLog(data) {
  const [row] = await db('activity_logs').insert(data).returning('*');
  return row;
}

/**
 * Paginated list of activity logs with optional filters.
 * Joins users table to return actor_full_name.
 *
 * @param {object} opts
 * @param {string}  [opts.centerId]
 * @param {string}  [opts.orgId]
 * @param {string}  [opts.actorUserId]
 * @param {string}  [opts.action]       - exact match filter
 * @param {string}  [opts.entityType]
 * @param {number}  [opts.limit=20]
 * @param {number}  [opts.offset=0]
 * @returns {{ data: object[], meta: { total: number, limit: number, offset: number } }}
 */
async function listLogs({ centerId, orgId, actorUserId, action, entityType, limit = 20, offset = 0 } = {}) {
  const base = db('activity_logs as al')
    .join('users as u', 'u.id', 'al.actor_user_id')
    .select(
      'al.id',
      'al.actor_user_id',
      'u.full_name     as actor_full_name',
      'al.actor_role',
      'al.action',
      'al.entity_type',
      'al.entity_id',
      'al.center_id',
      'al.org_id',
      'al.summary_en',
      'al.metadata',
      'al.created_at',
    )
    .orderBy('al.created_at', 'desc');

  // When filtering by center: show center-specific events AND org-level events
  // (center_id IS NULL) so course.create, fee.upsert etc. are visible to center managers.
  if (centerId) {
    base.where((q) => {
      q.where('al.center_id', centerId);
      if (orgId) {
        q.orWhere((q2) => q2.whereNull('al.center_id').where('al.org_id', orgId));
      }
    });
  } else if (orgId) {
    // Org-wide view (no center filter) — used by super_admin global feed
    base.where('al.org_id', orgId);
  }

  if (actorUserId) base.where('al.actor_user_id', actorUserId);
  if (action)      base.where('al.action', 'like', `${action}%`);  // prefix match: 'enrollment' matches 'enrollment.create'
  if (entityType)  base.where('al.entity_type', entityType);

  // Total count — must clearOrder() or PostgreSQL rejects ORDER BY alongside COUNT aggregate
  const [{ count }] = await base.clone().clearSelect().clearOrder().count('al.id as count');

  const data = await base.limit(limit).offset(offset);

  return {
    data,
    meta: { total: parseInt(count, 10), limit, offset },
  };
}

module.exports = { insertLog, listLogs };
