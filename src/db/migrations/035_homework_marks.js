exports.up = async (knex) => {
  await knex.schema.createTable('homework_marks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('assignment_id')
      .notNullable()
      .references('id')
      .inTable('homework_assignments')
      .onDelete('CASCADE');
    t.uuid('class_id')
      .nullable()
      .references('id')
      .inTable('classes')
      .onDelete('CASCADE');
    t.uuid('student_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('word_id')
      .notNullable()
      .references('id')
      .inTable('classwork_content_words')
      .onDelete('CASCADE');
    t.uuid('subtopic_id')
      .nullable()
      .references('id')
      .inTable('topic_subtopics')
      .onDelete('SET NULL');
    t.integer('marks_awarded').notNullable().defaultTo(0);
    t.string('error_type', 100).nullable();
    t.text('teacher_note').nullable();
    t.uuid('marked_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.unique(['assignment_id', 'student_id', 'word_id', 'subtopic_id'], {
      indexName: 'idx_unique_homework_mark',
    });
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('homework_marks');
};
