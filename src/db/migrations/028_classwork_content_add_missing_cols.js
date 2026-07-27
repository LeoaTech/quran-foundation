exports.up = async (knex) => {
  const hasTopicId = await knex.schema.hasColumn('classwork_content', 'topic_id');
  const hasLabel = await knex.schema.hasColumn('classwork_content', 'label');
  const hasCreatedBy = await knex.schema.hasColumn('classwork_content', 'created_by');

  await knex.schema.alterTable('classwork_content', (t) => {
    if (!hasTopicId) {
      t.uuid('topic_id')
        .nullable()
        .references('id')
        .inTable('topics')
        .onDelete('SET NULL');
    }
    if (!hasLabel) {
      t.string('label', 255).nullable();
    }
    if (!hasCreatedBy) {
      t.uuid('created_by')
        .nullable()               
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT');
    }
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('classwork_content', (t) => {
    t.dropColumn('topic_id');
    t.dropColumn('label');
    t.dropColumn('created_by');
  });
};
