
exports.up = async (knex) => {
  await knex.schema.alterTable('classwork_marks', (t) => {
    t.uuid('criteria_id')
      .nullable()
      .references('id')
      .inTable('course_classwork_criteria')
      .onDelete('RESTRICT');

    t.integer('marks_awarded').notNullable().defaultTo(0);
  });

  await knex.schema.alterTable('classwork_marks', (t) => {
    t.boolean('is_correct').nullable().alter();
  });

 await knex.raw(`
    ALTER TABLE classwork_marks
      DROP CONSTRAINT IF EXISTS idx_unique_classwork_mark
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX idx_unique_classwork_mark_v2
      ON classwork_marks (assignment_id, student_id, word_id, criteria_id)
      WHERE criteria_id IS NOT NULL
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP INDEX IF EXISTS idx_unique_classwork_mark_v2`);

  await knex.schema.alterTable('classwork_marks', (t) => {
    t.dropColumn('criteria_id');
    t.dropColumn('marks_awarded');
  });

  await knex.schema.alterTable('classwork_marks', (t) => {
    t.boolean('is_correct').notNullable().defaultTo(false).alter();
  });

  await knex.raw(`
    CREATE UNIQUE INDEX idx_unique_classwork_mark
      ON classwork_marks (assignment_id, student_id, word_id, topic_id)
  `);
};
