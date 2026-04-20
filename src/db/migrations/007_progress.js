// One progress_session per enrollment per day (enforced by unique constraint).
// Each session pairs 1-to-1 with a homework_entry (unique FK).
// homework_scores hold per-criterion integer marks.
//
// progress_sessions  ──1:1──  homework_entries  ──1:N──  homework_scores
//        │                                                      │
//        └── cw_topic / cw_subtopic (classwork covered)         └── homework_criteria

exports.up = async (knex) => {
  await knex.schema.createTable('progress_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('enrollment_id')
      .notNullable()
      .references('id')
      .inTable('enrollments')
      .onDelete('RESTRICT');
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
    t.date('session_date').notNullable();
    t.uuid('cw_topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('RESTRICT');
    t.uuid('cw_subtopic_id')
      .nullable()
      .references('id')
      .inTable('topic_subtopics')
      .onDelete('RESTRICT');
    // Qualitative grade — not a number, a teacher judgement
    t.string('cw_grade', 30);    // excellent | good | average | revision
    t.text('cw_note_ur');
    t.text('cw_note_ar');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    // One progress record per student (via enrollment) per day
    t.unique(['enrollment_id', 'session_date']);
  });

  // 1-to-1 with progress_sessions; unique FK enforces the pairing
  await knex.schema.createTable('homework_entries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('session_id')
      .notNullable()
      .unique()   // enforces 1-to-1
      .references('id')
      .inTable('progress_sessions')
      .onDelete('RESTRICT');
    t.boolean('is_submitted').notNullable().defaultTo(false);
    t.date('due_date');
    t.text('overall_note_ur');
    t.timestamp('recorded_at');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // One row per criterion per homework entry; marks_obtained is an integer
  // bounded by homework_criteria.max_marks (enforced at app layer)
  await knex.schema.createTable('homework_scores', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('homework_entry_id')
      .notNullable()
      .references('id')
      .inTable('homework_entries')
      .onDelete('RESTRICT');
    t.uuid('criteria_id')
      .notNullable()
      .references('id')
      .inTable('homework_criteria')
      .onDelete('RESTRICT');
    t.integer('marks_obtained').notNullable();
    t.text('note_ur');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['homework_entry_id', 'criteria_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('homework_scores');
  await knex.schema.dropTableIfExists('homework_entries');
  await knex.schema.dropTableIfExists('progress_sessions');
};
