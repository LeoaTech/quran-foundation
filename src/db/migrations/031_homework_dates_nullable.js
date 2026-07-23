exports.up = async (knex) => {
  await knex.schema.alterTable('homework_schedules', (t) => {
    t.date('first_due_date').nullable().alter();
  });
  await knex.schema.alterTable('homework_assignments', (t) => {
    t.date('due_date').nullable().alter();
  });
};

exports.down = async (knex) => {
 
};
