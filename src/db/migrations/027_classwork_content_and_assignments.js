// classwork_content  — Quranic verses/phrases tagged to a course level & topic.
// classwork_content_words — Individual words from the verse, each tagged
//   with the topic(rule tag) expected to be tested on that word.

exports.up = async (knex) => {
  // ── classwork_content ──────────────────────────────────────────────────────
  await knex.schema.createTable('classwork_content', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
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
    t.uuid('topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('SET NULL');
    t.integer('surah_number').nullable();   
    t.integer('ayah_number').nullable();    
    t.text('arabic_text').notNullable();    
    t.string('label', 255).nullable();     
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // ── classwork_content_words ────────────────────────────────────────────────
  await knex.schema.createTable('classwork_content_words', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('content_id')
      .notNullable()
      .references('id')
      .inTable('classwork_content')
      .onDelete('CASCADE');
    t.string('word_text', 255).notNullable();         
    t.integer('sequence_order').notNullable().defaultTo(1);
    t.jsonb('topic_ids').notNullable().defaultTo('[]'); //Array of topics list to evaluate single word
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });


  // classwork_assignments   — One classwork assignment per class session, links content with topics.


  // ── classwork_assignments ──────────────────────────────────────────────────
  await knex.schema.createTable('classwork_assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_session_id')
      .notNullable()
      .references('id')
      .inTable('class_session_plans')
      .onDelete('RESTRICT');
    t.jsonb('topic_ids').notNullable().defaultTo('[]');    // Topics covered in all sessions
    t.jsonb('content_ids').notNullable().defaultTo('[]');  // Verse IDs selected
    t.boolean('is_published').notNullable().defaultTo(false); 
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.timestamps(true, true);
    // One assignment per session
    t.unique(['class_session_id'], { indexName: 'idx_unique_classwork_assignment_session' });
  });


  // classwork_marks — One row per (assignment × student × word × topic);
//   stores whether the student recited the rule correctly.
  // ── classwork_marks ────────────────────────────────────────────────────────
  await knex.schema.createTable('classwork_marks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('assignment_id')
      .notNullable()
      .references('id')
      .inTable('classwork_assignments')
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
      .onDelete('RESTRICT');
    t.uuid('topic_id')
      .notNullable()
      .references('id')
      .inTable('topics')
      .onDelete('RESTRICT');
    t.boolean('is_correct').notNullable();
    t.string('error_type', 100).nullable();
    t.text('teacher_note').nullable();
    t.uuid('marked_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.timestamp('marked_at').defaultTo(knex.fn.now());
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.unique(
      ['assignment_id', 'student_id', 'word_id', 'topic_id'],
      { indexName: 'idx_unique_classwork_mark' },
    );
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('classwork_marks');
  await knex.schema.dropTableIfExists('classwork_assignments');
  await knex.schema.dropTableIfExists('classwork_content_words');
  await knex.schema.dropTableIfExists('classwork_content');
};
