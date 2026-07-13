const repo = require('../repositories/centers.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');

// ── Helpers ────────────────────────────────────────────────────────────────────

// Throw 403 if a non-super_admin user is accessing a center they are not scoped to.
function assertCenterAccess(user, centerId) {
  if (user.roles.includes('super_admin')) return;
  if (String(user.center_id) !== String(centerId)) {
    throw new AppError(
      'FORBIDDEN',
      'You do not have access to this center.',
      'آپ کو اس مرکز تک رسائی کی اجازت نہیں ہے۔',
      403,
    );
  }
}

function notFound(entity = 'Resource') {
  return new AppError(
    'NOT_FOUND',
    `${entity} not found.`,
    'مطلوبہ وسیلہ نہیں ملا۔',
    404,
  );
}

// ── Org ────────────────────────────────────────────────────────────────────────

async function getOrg() {
  const org = await repo.getOrg();
  if (!org) throw notFound('Organization');
  return org;
}

// ── Centers ────────────────────────────────────────────────────────────────────

async function listCenters({ query = {} } = {}) {
  const page    = Math.max(1, parseInt(query.page    || '1',  10));
  const perPage = Math.min(100, parseInt(query.per_page || '20', 10));

  const filters = {};
  if (query.city      !== undefined) filters.city     = query.city;
  if (query.is_active !== undefined) filters.isActive = query.is_active === 'true';

  const [rows, meta] = await Promise.all([
    repo.listCenters({ ...filters, page, perPage }),
    repo.countCenters(filters),
  ]);

  const total      = parseInt(meta.total, 10);
  const totalPages = Math.ceil(total / perPage);

  return {
    data: rows,
    meta: { page, per_page: perPage, total, total_pages: totalPages },
  };
}

async function getCenter({ user, centerId }) {
  assertCenterAccess(user, centerId);
  const center = await repo.getCenterById(centerId);
  if (!center) throw notFound('Center');
  return center;
}

async function createCenter({ user, body }) {
  // Resolve the single org so the center is linked correctly.
  const org = await repo.getOrg();
  if (!org) {
    throw new AppError(
      'NOT_FOUND',
      'No organization found. Create an organization first.',
      'کوئی ادارہ نہیں ملا۔ پہلے ادارہ بنائیں۔',
      404,
    );
  }

  const center = await repo.createCenter({ ...body, org_id: org.id });
  activityLog.log({
    actor:       user,
    action:      'center.create',
    entity_type: 'center',
    entity_id:   center.id,
    org_id:      org.id,
    summary_en:  `Created center "${center.name}"`,
    metadata:    { center_name: center.name },
  }).catch(() => {});
  return center;
}

async function updateCenter({ user, centerId, body }) {
  assertCenterAccess(user, centerId);

  const existing = await repo.getCenterById(centerId);
  if (!existing) throw notFound('Center');

  const updated = await repo.updateCenter(centerId, body);
  activityLog.log({
    actor:       user,
    action:      'center.update',
    entity_type: 'center',
    entity_id:   centerId,
    center_id:   centerId,
    org_id:      existing.org_id,
    summary_en:  `Updated center "${updated.name}"`,
    metadata:    { center_name: updated.name },
  }).catch(() => {});
  return updated;
}

// ── Classrooms ─────────────────────────────────────────────────────────────────

async function listClassrooms({ user, centerId, query = {} } = {}) {
  assertCenterAccess(user, centerId);

  const center = await repo.getCenterById(centerId);
  if (!center) throw notFound('Center');

  const filters = {};
  if (query.is_active !== undefined) filters.isActive = query.is_active === 'true';

  return repo.listClassrooms(centerId, filters);
}

async function createClassroom({ user, centerId, body }) {
  assertCenterAccess(user, centerId);

  const center = await repo.getCenterById(centerId);
  if (!center || !center.is_active) {
    throw new AppError(
      'NOT_FOUND',
      'Center not found or inactive.',
      'مرکز نہیں ملا یا غیر فعال ہے۔',
      404,
    );
  }

  return repo.createClassroom({ ...body, center_id: centerId });
}

module.exports = {
  getOrg,
  listCenters,
  getCenter,
  createCenter,
  updateCenter,
  listClassrooms,
  createClassroom,
};
