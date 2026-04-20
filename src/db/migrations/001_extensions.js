exports.up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
};

exports.down = async (knex) => {
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
};
