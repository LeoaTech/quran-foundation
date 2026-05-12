const repo = require('../repositories/donations.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');
const db = require('../db/knex');

function forbidden() {
  return new AppError(
    'FORBIDDEN',
    'You do not have access to perform this action.',
    'آپ کو یہ عمل کرنے کی اجازت نہیں ہے۔',
    403
  );
}

function assertCenterAccess(user, targetCenterId) {
  if (user.roles.includes('super_admin')) return;
  if (user.center_id !== targetCenterId) {
    throw forbidden();
  }
}

async function recordDonation({ user: actor, centerId, body }) {
  assertCenterAccess(actor, centerId);

  const {
    donor_type,
    donor_user_id,
    donor_name,
    donor_phone,
    amount,
    date_received,
    purpose,
    notes,
  } = body;

  if (!donor_type || !amount || !date_received || !purpose) {
    throw new AppError('VALIDATION_ERROR', 'Missing required fields.', 'مطلوبہ خانے خالی ہیں۔', 400);
  }

  const donationData = {
    center_id: centerId,
    donor_type,
    donor_user_id: donor_user_id || null,
    donor_name: donor_name || 'Anonymous',
    donor_phone: donor_phone || null,
    amount,
    date_received,
    purpose,
    notes: notes || null,
    recorded_by: actor.id,
  };

  const donation = await db.transaction(async (trx) => {
    const created = await repo.createDonation(donationData, trx);

    await activityLog.log({
      actor,
      action: 'donation.collect',
      entity_type: 'donation',
      entity_id: created.id,
      center_id: centerId,
      summary_en: `Recorded donation of ${amount} PKR from ${created.donor_name}`,
      metadata: {
        amount,
        donor_type,
        donor_name: created.donor_name,
        purpose,
      },
    }, trx).catch(() => {}); // Catch safely

    return created;
  });

  return donation;
}

async function listDonations({ user: actor, centerId, query }) {
  assertCenterAccess(actor, centerId);

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const perPage = Math.min(100, parseInt(query.per_page || '20', 10));
  const donorType = query.donor_type;

  const [rows, meta] = await Promise.all([
    repo.listDonations(centerId, { donorType, page, perPage }),
    repo.countDonations(centerId, { donorType }),
  ]);

  const total = parseInt(meta.total, 10);
  const totalPages = Math.ceil(total / perPage);

  return {
    data: rows,
    meta: { page, per_page: perPage, total, total_pages: totalPages },
  };
}

module.exports = {
  recordDonation,
  listDonations,
};
