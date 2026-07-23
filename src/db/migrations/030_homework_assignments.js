// Homework Assignments System


exports.up = async (knex) => {
  // ── homework_schedules ─────────────────────────────────────────────────────
  await knex.schema.createTable('homework_schedules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('RESTRICT');
    t.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
      .onDelete('RESTRICT');
    t.string('frequency', 20).notNullable().defaultTo('weekly');
    t.integer('total_assignments').notNullable().defaultTo(1);
    t.date('first_due_date').notNullable(); 
    t.text('instructions');                 
    t.boolean('is_active').notNullable().defaultTo(true);
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.timestamps(true, true);

    // One schedule per course per org
    t.unique(['org_id', 'course_id']);
  });

  // ── homework_assignments ───────────────────────────────────────────────────
   await knex.schema.createTable('homework_assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('schedule_id')
      .notNullable()
      .references('id')
      .inTable('homework_schedules')
      .onDelete('CASCADE');
    t.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
      .onDelete('RESTRICT');
    t.uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('RESTRICT');
    t.integer('assignment_number').notNullable();  
    t.string('title', 255).notNullable();
    t.string('title_ur', 255);
    t.text('instructions');
    t.date('due_date').notNullable();             
    t.jsonb('topic_ids').notNullable().defaultTo('[]');
    t.jsonb('criteria_ids').notNullable().defaultTo('[]');
    t.boolean('is_published').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.timestamps(true, true);

    t.unique(['schedule_id', 'assignment_number']);
  });

  // ── homework_submissions ───────────────────────────────────────────────────
  await knex.schema.createTable('homework_submissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('assignment_id')
      .notNullable()
      .references('id')
      .inTable('homework_assignments')
      .onDelete('CASCADE');
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('CASCADE');
    t.uuid('student_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.string('status', 30).notNullable().defaultTo('pending');
    t.date('submitted_at').nullable();
    t.integer('marks_awarded').nullable();  // marks_awarded: teacher gives score based on criteria-driven evaluation.
    t.integer('max_marks').nullable();       
    t.text('teacher_note').nullable();
    t.uuid('marked_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.date('marked_at').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.unique(['assignment_id', 'class_id', 'student_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('homework_submissions');
  await knex.schema.dropTableIfExists('homework_assignments');
  await knex.schema.dropTableIfExists('homework_schedules');
};
