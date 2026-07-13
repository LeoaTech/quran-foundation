const repo        = require('../repositories/activityLog.repository');
const centersRepo = require('../repositories/centers.repository');
const { AppError } = require('../utils/errors');

// GET /centers/:center_id/activity
async function listCenterActivity(req, res, next) {
  try {
    const centerId = req.params.center_id;

    // center_manager must be scoped to this center
    if (!req.user.roles.includes('super_admin')) {
      if (req.String(user.center_id) !== String(centerId)) {
        throw new AppError(
          'FORBIDDEN',
          'You do not have access to this center.',
          'آپ کو اس مرکز تک رسائی کی اجازت نہیں ہے۔',
          403,
        );
      }
    }

    // Resolve org so we can include org-level events (course.create, fee.upsert, etc.)
    // in the center feed — these have center_id=NULL but share the same org_id.
    const org = await centersRepo.getOrg();

    const limit       = Math.min(100, Math.max(1, parseInt(req.query.limit  || '20', 10)));
    const offset      = Math.max(0,               parseInt(req.query.offset || '0',  10));
    const action      = req.query.action       || undefined;
    const actorUserId = req.query.actor_user_id || undefined;

    const result = await repo.listLogs({
      centerId,
      orgId:  org?.id,   // enables org-level events to appear alongside center events
      action,
      actorUserId,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /activity  (super_admin only — org-wide)
async function listOrgActivity(req, res, next) {
  try {
    const org = await centersRepo.getOrg();

    const limit       = Math.min(100, Math.max(1, parseInt(req.query.limit  || '20', 10)));
    const offset      = Math.max(0,               parseInt(req.query.offset || '0',  10));
    const action      = req.query.action       || undefined;
    const actorUserId = req.query.actor_user_id || undefined;

    const result = await repo.listLogs({ orgId: org?.id, action, actorUserId, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCenterActivity, listOrgActivity };
