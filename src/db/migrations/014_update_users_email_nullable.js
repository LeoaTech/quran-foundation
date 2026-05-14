exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.string('email', 255).nullable().alter();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.string('email', 255).notNullable().alter();
  });
};
