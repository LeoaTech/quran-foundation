exports.up = async (knex) => {
  const hasLockCol = await knex.schema.hasColumn('homework_submissions', 'locked_by_teacher_id');
  if (!hasLockCol) {
    await knex.schema.table('homework_submissions', (table) => {
      table.uuid('locked_by_teacher_id').nullable();
      table.string('locked_by_teacher_name').nullable();
      table.timestamp('locked_at').nullable();
    });
  }
};

exports.down = async (knex) => {
  const hasLockCol = await knex.schema.hasColumn('homework_submissions', 'locked_by_teacher_id');
  if (hasLockCol) {
    await knex.schema.table('homework_submissions', (table) => {
      table.dropColumn('locked_by_teacher_id');
      table.dropColumn('locked_by_teacher_name');
      table.dropColumn('locked_at');
    });
  }
};
