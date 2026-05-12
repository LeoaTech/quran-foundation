const db = require('../db/knex');

async function createDonation(data, trx) {
  const t = trx || db;
  const [donation] = await t('donations').insert(data).returning('*');
  return donation;
}

function listDonations(centerId, { donorType, page = 1, perPage = 20 } = {}) {
  const query = db('donations as d')
    .leftJoin('users as u', 'u.id', 'd.recorded_by')
    .where('d.center_id', centerId)
    .select(
      'd.*',
      'u.full_name as recorded_by_name'
    )
    .orderBy('d.date_received', 'desc')
    .orderBy('d.created_at', 'desc');

  if (donorType) {
    query.where('d.donor_type', donorType);
  }

  return query.limit(perPage).offset((page - 1) * perPage);
}

function countDonations(centerId, { donorType } = {}) {
  const query = db('donations as d')
    .where('d.center_id', centerId)
    .count('d.id as total');

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
