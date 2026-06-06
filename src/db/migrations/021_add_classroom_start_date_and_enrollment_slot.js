exports.up = async (knex) => {
  await knex.schema.alterTable('classes', (t) => {
    t.date('start_date').nullable();
  });

  await knex.schema.alterTable('enrollments', (t) => {
    t.uuid('class_schedule_id')
      .nullable()
      .references('id')
      .inTable('class_schedules')
      .onDelete('RESTRICT');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('enrollments', (t) => {
    t.dropColumn('class_schedule_id');
  });

  await knex.schema.alterTable('classes', (t) => {
    t.dropColumn('start_date');
  });
};
