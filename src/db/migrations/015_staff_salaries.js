exports.up = async (knex) => {
  await knex.schema.createTable('staff_details', (t) => {
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('CASCADE');
    t.decimal('base_salary', 10, 2).notNullable().defaultTo(0);
    t.date('joining_date').notNullable().defaultTo(knex.fn.now());
    t.primary(['user_id', 'center_id']);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('salary_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('staff_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.decimal('amount_paid', 10, 2).notNullable();
    t.string('payment_method', 30).notNullable().defaultTo('cash');
    t.date('payment_date').notNullable().defaultTo(knex.fn.now());
    t.uuid('paid_by_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('notes').nullable();
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('salary_payments');
  await knex.schema.dropTableIfExists('staff_details');
};
