// Add per-word marks in the content + add notes(comments) to classwork content.

// total_marks on content = Max Marks computed on save for homework content.

exports.up = async (knex) => {
  // ── classwork_content_words: note + rule_details
  await knex.schema.alterTable('classwork_content_words', (t) => {
    t.text('note').nullable();                                   
    t.jsonb('rule_details').notNullable().defaultTo('[]');        
  });

  // ── classwork_content: rule(tagged)_marks + total_marks─
  await knex.schema.alterTable('classwork_content', (t) => {
    t.jsonb('rule_marks').notNullable().defaultTo('{}');          
    t.integer('total_marks').notNullable().defaultTo(0);          // max marks (computed)
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('classwork_content_words', (t) => {
    t.dropColumn('note');
    t.dropColumn('rule_details');
  });
  await knex.schema.alterTable('classwork_content', (t) => {
    t.dropColumn('rule_marks');
    t.dropColumn('total_marks');
  });
};
