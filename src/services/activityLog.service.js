const repo = require('../repositories/activityLog.repository');

/**
 * Fire-and-forget activity logger.
 *
 * Call as:   activityLog.log({ actor, action, ... }).catch(() => {});
 *
 * @param {object}  opts
 * @param {object}  opts.actor         - req.user (must have .id and .roles[])
 * @param {string}  opts.action        - e.g. 'enrollment.create'
 * @param {string}  opts.entity_type   - e.g. 'enrollment'
 * @param {string}  [opts.entity_id]   - UUID of the affected row
 * @param {string}  [opts.center_id]
 * @param {string}  [opts.org_id]
 * @param {string}  opts.summary_en    - human-readable English
 * @param {object}  [opts.metadata]    - extra context
 */
async function log({ actor, action, entity_type, entity_id, center_id, org_id, summary_en, metadata }) {
  try {
    const actor_role = (actor.roles && actor.roles[0]) || 'unknown';
    await repo.insertLog({
      actor_user_id: actor.id,
      actor_full_name: actor.full_name || 'Unknown',
      actor_role,
      action,
      entity_type,
      entity_id:  entity_id  || null,
      center_id:  center_id  || null,
      org_id:     org_id     || null,
      summary_en,
      metadata:   metadata   || {},
    });
  } catch (err) {
    // Logging must NEVER break the primary operation.
    console.error('[activityLog] Failed to write log:', err.message);
  }
}

module.exports = { log };
