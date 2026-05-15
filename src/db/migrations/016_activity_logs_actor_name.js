exports.up = async (knex) => {
  await knex.schema.alterTable('activity_logs', (t) => {
    t.string('actor_full_name', 255).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('activity_logs', (t) => {
    t.dropColumn('actor_full_name');
  });
};
