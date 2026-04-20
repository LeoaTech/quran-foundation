// attendance_sessions: one header per class per calendar day.
// attendance_records: one row per student per session.
// Kept separate from progress so attendance can be taken independently.

exports.up = async (knex) => {
  await knex.schema.createTable('enrollments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('student_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('RESTRICT');
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.string('status', 30).notNullable().defaultTo('active'); // active | withdrawn
    t.date('enrolled_on').notNullable();
    t.date('withdrawn_on');
    t.string('prior_level', 100);
    t.text('notes_ur');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['class_id', 'student_user_id']);
  });

  await knex.schema.createTable('attendance_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('RESTRICT');
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.uuid('marked_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.date('session_date').notNullable();
    t.timestamp('marked_at').notNullable().defaultTo(knex.fn.now());
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['class_id', 'session_date']);
  });

  await knex.schema.createTable('attendance_records', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('session_id')
      .notNullable()
      .references('id')
      .inTable('attendance_sessions')
      .onDelete('RESTRICT');
    t.uuid('student_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('status', 20).notNullable().defaultTo('present'); // present | absent | late
    t.text('note_ur');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['session_id', 'student_user_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('attendance_records');
  await knex.schema.dropTableIfExists('attendance_sessions');
  await knex.schema.dropTableIfExists('enrollments');
};
