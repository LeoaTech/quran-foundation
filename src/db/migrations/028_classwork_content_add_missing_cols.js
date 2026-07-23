exports.up = async (knex) => {
  await knex.schema.alterTable('classwork_content', (t) => {
    t.uuid('topic_id')
      .nullable()
      .references('id')
      .inTable('topics')
      .onDelete('SET NULL');
    t.string('label', 255).nullable();
    t.uuid('created_by')
      .nullable()               
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('classwork_content', (t) => {
    t.dropColumn('topic_id');
    t.dropColumn('label');
    t.dropColumn('created_by');
  });
};
