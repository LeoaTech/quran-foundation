exports.up = async (knex) => {
  await knex.schema.createTable('course_classwork_criteria', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
      .onDelete('RESTRICT');
    t.uuid('topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('RESTRICT');
    t.uuid('subtopic_id')
      .nullable()
      .references('id')
      .inTable('topic_subtopics')
      .onDelete('RESTRICT');
    t.string('label', 255).notNullable();
    t.string('label_ur', 255);
    t.integer('max_marks').notNullable().defaultTo(10);
    t.integer('display_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('course_classwork_criteria');
};
