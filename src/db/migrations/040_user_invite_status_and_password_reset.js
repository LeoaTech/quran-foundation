exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.string('status', 50).notNullable().defaultTo('active').index();
    t.boolean('must_reset_password').notNullable().defaultTo(false);
    t.timestamp('credentials_sent_at').nullable();
    t.text('invite_error').nullable();
  });

  // Backfill existing users:
  await knex('users').where({ is_active: false }).update({ status: 'inactive' });
  await knex('users').where({ is_active: true }).update({ status: 'active' });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('invite_error');
    t.dropColumn('credentials_sent_at');
    t.dropColumn('must_reset_password');
    t.dropColumn('status');
  });
};
