// Courses are scoped to an organization (shared curriculum across all its centers).
// Topics are admin-teacher-created per course — free-form, bilingual.
// topic_subtopics optionally break a topic into finer units.

exports.up = async (knex) => {
  await knex.schema.createTable('courses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('RESTRICT');
    t.string('name', 255).notNullable();
    t.string('name_ur', 255);
    t.string('name_ar', 255);
    t.string('type', 50);          // hifz | nazra | tajweed | arabic
    t.text('description_ur');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('course_levels', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
      .onDelete('RESTRICT');
    t.string('title', 255).notNullable();
    t.string('title_ur', 255);
    t.text('description_ur');
    t.integer('level_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('topics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('course_id')
      .notNullable()
      .references('id')
      .inTable('courses')
      .onDelete('RESTRICT');
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('title', 255).notNullable();
    t.string('title_ur', 255);
    t.string('title_ar', 255);
    t.text('description_ur');
    t.integer('display_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('topic_subtopics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('topic_id')
      .notNullable()
      .references('id')
      .inTable('topics')
      .onDelete('RESTRICT');
    t.string('title', 255).notNullable();
    t.string('title_ur', 255);
    t.string('title_ar', 255);
    t.integer('display_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('topic_subtopics');
  await knex.schema.dropTableIfExists('topics');
  await knex.schema.dropTableIfExists('course_levels');
  await knex.schema.dropTableIfExists('courses');
};
