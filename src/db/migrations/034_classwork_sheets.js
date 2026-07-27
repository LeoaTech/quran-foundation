exports.up = async (knex) => {
  // ── classwork_sheets ──────────────────────────────────────────────────────────
  await knex.schema.createTable('classwork_sheets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_session_id')
      .notNullable()
      .references('id')
      .inTable('class_session_plans')
      .onDelete('RESTRICT');
    t.uuid('topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('SET NULL');
    t.uuid('subtopic_id')
      .nullable()
      .references('id')
      .inTable('topic_subtopics')
      .onDelete('SET NULL');
    t.text('description').nullable();
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.timestamps(true, true);

    t.unique(['class_session_id'], { indexName: 'idx_unique_classwork_sheet_session' });
  });

  // ── classwork_sheet_entries ───────────────────────────────────────────────────
  await knex.schema.createTable('classwork_sheet_entries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('sheet_id')
      .notNullable()
      .references('id')
      .inTable('classwork_sheets')
      .onDelete('CASCADE');
    t.uuid('student_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('SET NULL');
    t.uuid('subtopic_id')
      .nullable()
      .references('id')
      .inTable('topic_subtopics')
      .onDelete('SET NULL');
    t.string('grade', 50).nullable();
    t.text('comments').nullable();
    t.uuid('marked_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.unique(['sheet_id', 'student_id'], { indexName: 'idx_unique_classwork_sheet_entry' });
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('classwork_sheet_entries');
  await knex.schema.dropTableIfExists('classwork_sheets');
};
