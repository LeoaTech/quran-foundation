// Adds `is_minor` boolean to users table.
// Minor students (under 18) do not have their own phone number;
// their guardian's phone is used for contact and stored on the `guardians` table.
// Minor users have phone = NULL in the users table — no uniqueness conflict.

exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.boolean('is_minor').notNullable().defaultTo(false);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('is_minor');
  });
};
