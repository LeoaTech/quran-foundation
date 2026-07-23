exports.up = async function (knex) {
  await knex.schema.createTable('homework_assignment_content', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('assignment_id')
      .notNullable()
      .references('id')
      .inTable('homework_assignments')
      .onDelete('CASCADE');
    table
      .uuid('content_id')
      .notNullable()
      .references('id')
      .inTable('classwork_content')
      .onDelete('CASCADE');
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['assignment_id', 'content_id']);
  });

  await knex.schema.alterTable('homework_assignments', (table) => {
    table.integer('total_marks').notNullable().defaultTo(0);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('homework_assignments', (table) => {
    table.dropColumn('total_marks');
  });

  await knex.schema.dropTableIfExists('homework_assignment_content');
};
