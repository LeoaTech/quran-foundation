exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.jsonb('metadata').defaultTo('{}');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('metadata');
  });
};
