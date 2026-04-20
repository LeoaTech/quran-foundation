// Role hierarchy enforced at app level via RBAC middleware, not DB.
// Users have no center_id — center scope flows through user_roles and enrollments,
// allowing a teacher to belong to multiple centers.

exports.up = async (knex) => {
  await knex.schema.createTable('roles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 50).notNullable().unique(); // super_admin | center_manager | teacher | student | guardian
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('full_name', 255).notNullable();
    t.string('full_name_ur', 255);
    t.string('display_name_ar', 255);
    t.string('phone', 50);
    t.string('whatsapp', 50);
    t.date('date_of_birth');
    t.string('gender', 20);                               // male | female | other
    t.string('preferred_lang', 10).notNullable().defaultTo('ur'); // en | ur | ar
    t.timestamp('last_login_at');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('user_roles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('RESTRICT');
    t.uuid('center_id').nullable().references('id').inTable('centers').onDelete('RESTRICT');
    t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.unique(['user_id', 'role_id', 'center_id']);
  });

  // Each row is one guardian↔student relationship.
  // A guardian overseeing 3 students has 3 rows; is_primary marks the main contact.
  await knex.schema.createTable('guardians', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('student_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.uuid('guardian_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.string('relation', 50);   // father | mother | sibling | other
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.unique(['student_user_id', 'guardian_user_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('guardians');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('roles');
};
