exports.up = async (knex) => {
  // 1. Add difficulty_level, fee, and duration_months to courses table
  await knex.schema.alterTable('courses', (t) => {
    t.string('difficulty_level', 50).nullable(); // beginner | intermediate | advance
    t.decimal('fee', 10, 2).notNullable().defaultTo(0);
    t.integer('duration_months').nullable();
  });

  // 2. Add description to topics table for English descriptions
  await knex.schema.alterTable('topics', (t) => {
    t.text('description').nullable();
  });

  // 3. Create center_teacher_topics table
  await knex.schema.createTable('center_teacher_topics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.uuid('teacher_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('topic_id')
      .notNullable()
      .references('id')
      .inTable('topics')
      .onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    
    t.unique(['center_id', 'teacher_user_id', 'topic_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('center_teacher_topics');
  
  await knex.schema.alterTable('topics', (t) => {
    t.dropColumn('description');
  });

  await knex.schema.alterTable('courses', (t) => {
    t.dropColumn('difficulty_level');
    t.dropColumn('fee');
    t.dropColumn('duration_months');
  });
};
