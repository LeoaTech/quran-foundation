// Adds audit columns to attendance_records so that any correction made after
// initial marking is traceable to the correcting teacher and timestamped.

exports.up = async (knex) => {
  await knex.schema.alterTable('attendance_records', (t) => {
    t.uuid('corrected_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.timestamp('corrected_at').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('attendance_records', (t) => {
    t.dropColumn('corrected_by');
    t.dropColumn('corrected_at');
  });
};
