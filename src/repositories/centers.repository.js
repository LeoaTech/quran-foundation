const db = require('../db/knex');

// ── Organization ───────────────────────────────────────────────────────────────

function getOrg() {
  return db('organizations').where({ is_active: true }).first();
}

// ── Centers ────────────────────────────────────────────────────────────────────

function listCenters({ city, isActive, page = 1, perPage = 20 } = {}) {
  const query = db('centers').orderBy('name', 'asc');
  if (city       !== undefined) query.where({ city });
  if (isActive   !== undefined) query.where({ is_active: isActive });
  return query.limit(perPage).offset((page - 1) * perPage);
}

function countCenters({ city, isActive } = {}) {
  const query = db('centers').count('id as total');
  if (city     !== undefined) query.where({ city });
  if (isActive !== undefined) query.where({ is_active: isActive });
  return query.first();
}

function getCenterById(centerId) {
  return db('centers').where({ id: centerId }).first();
}

async function createCenter(data) {
  const [row] = await db('centers').insert(data).returning('*');
  return row;
}

async function updateCenter(centerId, data) {
  const [row] = await db('centers')
    .where({ id: centerId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Classrooms ─────────────────────────────────────────────────────────────────

function listClassrooms(centerId, { isActive } = {}) {
  const query = db('classrooms').where({ center_id: centerId }).orderBy('name', 'asc');
  if (isActive !== undefined) query.where({ is_active: isActive });
  return query;
}

function getClassroomById(id) {
  return db('classrooms').where({ id }).first();
}

async function createClassroom(data) {
  const [row] = await db('classrooms').insert(data).returning('*');
  return row;
}

module.exports = {
  getOrg,
  listCenters,
  countCenters,
  getCenterById,
  createCenter,
  updateCenter,
  listClassrooms,
  getClassroomById,
  createClassroom,
};
