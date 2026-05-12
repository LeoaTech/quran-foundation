// Adds duration_months to course_levels (how long a level takes).
// Adds course_level_fees: one fee record per course level (upsert pattern).

exports.up = async (knex) => {
  // ── 1. Add duration_months to existing course_levels table ─────────────────
  await knex.schema.alterTable('course_levels', (t) => {
    t.integer('duration_months').nullable(); // e.g. 6 → "6 months"
  });

  // ── 2. Create course_level_fees table ─────────────────────────────────────
  await knex.schema.createTable('course_level_fees', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('course_level_id')
      .notNullable()
      .unique()                           // one fee record per level
      .references('id')
      .inTable('course_levels')
      .onDelete('RESTRICT');
    t.decimal('full_fee', 10, 2).notNullable();
    t.string('currency', 3).notNullable().defaultTo('PKR');
    t.text('notes').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('course_level_fees');
  await knex.schema.alterTable('course_levels', (t) => {
    t.dropColumn('duration_months');
  });
};
