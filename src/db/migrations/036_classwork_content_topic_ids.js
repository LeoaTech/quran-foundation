exports.up = async (knex) => {
  const hasTopicIds = await knex.schema.hasColumn('classwork_content', 'topic_ids');

  await knex.schema.alterTable('classwork_content', (t) => {
    if (!hasTopicIds) {
      t.jsonb('topic_ids').notNullable().defaultTo('[]');
    }
  });

  // Migrate existing topic_id to topic_ids
  if (!hasTopicIds) {
    await knex.raw(`
      UPDATE classwork_content 
      SET topic_ids = jsonb_build_array(topic_id) 
      WHERE topic_id IS NOT NULL;
    `);
  }
};

exports.down = async (knex) => {
  await knex.schema.alterTable('classwork_content', (t) => {
    t.dropColumn('topic_ids');
  });
};
