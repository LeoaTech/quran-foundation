exports.up = async (knex) => {
  await knex.schema.createTable('class_session_plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('CASCADE');
    t.uuid('schedule_id')
      .nullable()
      .references('id')
      .inTable('class_schedules')
      .onDelete('SET NULL');
    t.date('session_date').notNullable();
    t.uuid('topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('SET NULL');
    t.string('topic_title', 255);
    t.text('topic_title_ur');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['class_id', 'session_date', 'schedule_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('class_session_plans');
};
