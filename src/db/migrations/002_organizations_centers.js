exports.up = async (knex) => {
  await knex.schema.createTable('organizations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 255).notNullable();
    t.string('name_ur', 255);
    t.string('name_ar', 255);
    t.string('logo_url', 500);
    t.string('contact_email', 255);
    t.string('contact_phone', 50);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('centers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('org_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('RESTRICT');
    t.string('name', 255).notNullable();
    t.string('name_ur', 255);
    t.text('address');
    t.text('address_ur');
    t.string('city', 100);
    t.string('phone', 50);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('classrooms', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.string('name', 255).notNullable();
    t.string('name_ur', 255);
    t.integer('capacity');
    t.string('session_name', 255);
    t.date('session_date');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('classrooms');
  await knex.schema.dropTableIfExists('centers');
  await knex.schema.dropTableIfExists('organizations');
};
