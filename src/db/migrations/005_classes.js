// homework_criteria are defined per class by the admin teacher.
// They are NEVER hard-deleted per domain rules — only is_active=false.
// Each criterion can optionally be pinned to a specific topic/subtopic.

exports.up = async (knex) => {
  await knex.schema.createTable('classes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
      .onDelete('RESTRICT');
    t.uuid('course_level_id')
      .nullable()
      .references('id')
      .inTable('course_levels')
      .onDelete('RESTRICT');
    t.string('name', 255).notNullable();
    t.string('name_ur', 255);
    t.integer('max_capacity');
    t.string('schedule_days', 100); // e.g. "monday,wednesday,friday"
    t.time('start_time');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('class_teachers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('RESTRICT');
    t.uuid('teacher_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.date('assigned_from');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['class_id', 'teacher_user_id']);
  });

  // NEVER hard-deleted — only deactivated.
  await knex.schema.createTable('homework_criteria', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('RESTRICT');
    // Optional: criterion scoped to a specific topic/subtopic
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
    t.string('label', 255).notNullable();    // e.g. "Recitation accuracy"
    t.string('label_ur', 255);
    t.integer('max_marks').notNullable().defaultTo(10);
    t.integer('display_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('homework_criteria');
  await knex.schema.dropTableIfExists('class_teachers');
  await knex.schema.dropTableIfExists('classes');
};
