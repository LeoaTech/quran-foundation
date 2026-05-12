const db = require('../db/knex');

// Create a new fee payment
async function createFeePayment(data, trx = null) {
  const query = trx ? trx('fee_payments') : db('fee_payments');
  const [row] = await query.insert(data).returning('*');
  return row;
}

module.exports = {
  createFeePayment,
};
