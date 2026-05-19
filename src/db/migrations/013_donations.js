exports.up = async (knex) => {
  await knex.schema.createTable('donations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('center_id').notNullable().references('id').inTable('centers').onDelete('CASCADE');

    // Donor tracking
    t.string('donor_type', 50).notNullable(); // student, teacher, visitor, guardian
    t.uuid('donor_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('donor_name', 255).notNullable().defaultTo('Anonymous');
    t.string('donor_phone', 50).nullable();

    // Financials
    t.decimal('amount', 12, 2).notNullable();
    t.date('date_received').notNullable();
    t.string('purpose', 100).notNullable(); // 'General (Sadaqah)', 'Zakat', etc
    t.text('notes').nullable();

    // Audit
    t.uuid('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('donations');
};
