const db = require('../db/knex');

async function createDonation(data, trx) {
  const t = trx || db;
  const [donation] = await t('donations').insert(data).returning('*');
  return donation;
}

function listDonations({ donorType, page = 1, perPage = 20 } = {}) {
  const query = db('donations as d')
    .leftJoin('users as u', 'u.id', 'd.recorded_by');

  query.select(
      'd.*',
      'u.full_name as recorded_by_name',
      db.raw(`(SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = d.recorded_by LIMIT 1) as recorded_by_role`)
    )
    .orderBy('d.date_received', 'desc')
    .orderBy('d.created_at', 'desc');

  if (donorType) {
    query.where('d.donor_type', donorType);
  }

  return query.limit(perPage).offset((page - 1) * perPage);
}

function countDonations({ donorType } = {}) {
  const query = db('donations as d');

  query.count('d.id as total');

  if (donorType) {
    query.where('d.donor_type', donorType);
  }

  return query.first();
}

module.exports = {
  createDonation,
  listDonations,
  countDonations,
};
