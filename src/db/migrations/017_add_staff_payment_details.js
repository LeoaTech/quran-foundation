exports.up = async (knex) => {
  await knex.schema.alterTable('staff_details', (t) => {
    t.string('payment_method', 30).notNullable().defaultTo('cash');
    t.string('bank_name', 100).nullable();
    t.string('account_number', 100).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('staff_details', (t) => {
    t.dropColumn('payment_method');
    t.dropColumn('bank_name');
    t.dropColumn('account_number');
  });
};
