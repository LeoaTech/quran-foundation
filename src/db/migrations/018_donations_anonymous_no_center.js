exports.up = async (knex) => {
  await knex.schema.alterTable('donations', (t) => {
    // Allow donations without a center (organization-level)
    t.uuid('center_id').nullable().alter();
    // Donor can choose to stay anonymous in listings
    t.boolean('is_anonymous').notNullable().defaultTo(false);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('donations', (t) => {
    t.dropColumn('is_anonymous');
    t.uuid('center_id').notNullable().alter();
  });
};
