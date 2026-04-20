// Formal assessments (written, oral, or topic-specific tests) per class.
// Results reference topics/subtopics so oral examiners can record
// exactly what was tested, alongside a qualitative oral_grade.

exports.up = async (knex) => {
  await knex.schema.createTable('assessments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('RESTRICT');
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('title', 255).notNullable();
    t.string('title_ur', 255);
    t.string('type', 30);          // written | oral | topic_test
    t.date('assessment_date');
    t.integer('max_score');
    t.text('instructions_ur');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('assessment_results', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('assessment_id')
      .notNullable()
      .references('id')
      .inTable('assessments')
      .onDelete('RESTRICT');
    t.uuid('student_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('examiner_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.integer('score');
    t.string('oral_grade', 20);    // excellent | good | average | fail
    t.uuid('topic_tested_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('RESTRICT');
    t.uuid('subtopic_tested_id')
      .nullable()
      .references('id')
      .inTable('topic_subtopics')
      .onDelete('RESTRICT');
    t.text('remarks_ur');
    t.text('remarks_ar');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['assessment_id', 'student_user_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('assessment_results');
  await knex.schema.dropTableIfExists('assessments');
};
