exports.up = async (knex) => {
  const hasAudioUrl = await knex.schema.hasColumn('homework_submissions', 'audio_url');
  if (!hasAudioUrl) {
    await knex.schema.table('homework_submissions', (table) => {
      table.text('audio_url').nullable();
      table.integer('audio_duration').nullable(); // duration in seconds
      table.timestamp('audio_submitted_at').nullable();
    });
  }
};

exports.down = async (knex) => {
  const hasAudioUrl = await knex.schema.hasColumn('homework_submissions', 'audio_url');
  if (hasAudioUrl) {
    await knex.schema.table('homework_submissions', (table) => {
      table.dropColumn('audio_url');
      table.dropColumn('audio_duration');
      table.dropColumn('audio_submitted_at');
    });
  }
};
