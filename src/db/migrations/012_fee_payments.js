// fee_payments: tracks cash payments collected for course level enrollments
// Phase 1 only supports manual cash payments.

exports.up = async (knex) => {
  await knex.schema.createTable('fee_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('enrollment_id')
      .notNullable()
      .references('id')
      .inTable('enrollments')
      .onDelete('RESTRICT');
    t.decimal('amount_paid', 10, 2).notNullable();
    t.string('currency', 3).notNullable().defaultTo('PKR');
    t.string('payment_method', 30).notNullable().defaultTo('cash');
    t.uuid('received_by_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.date('payment_date').notNullable().defaultTo(knex.fn.now());
    t.text('notes').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('fee_payments');
};
