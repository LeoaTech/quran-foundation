// Append-only audit trail for all write actions across the LMS.
// Logs are immutable — no updated_at, no soft-delete.

exports.up = async (knex) => {
  await knex.schema.createTable('activity_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Who did it
    t.uuid('actor_user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('actor_role', 50).notNullable(); // snapshot at time of action

    // What was affected
    t.string('action', 100).notNullable();       // e.g. 'enrollment.create'
    t.string('entity_type', 100).notNullable();  // e.g. 'enrollment'
    t.uuid('entity_id').nullable();              // PK of the affected record

    // Where (nullable: org-level actions have no center_id)
    t.uuid('org_id')
      .nullable()
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
    t.uuid('center_id')
      .nullable()
      .references('id')
      .inTable('centers')
      .onDelete('SET NULL');

    // Human-readable summary + extra context
    t.text('summary_en').notNullable();
    t.jsonb('metadata').nullable().defaultTo('{}');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Primary feed: per-center timeline
  await knex.schema.raw(
    'CREATE INDEX idx_activity_logs_center ON activity_logs (center_id, created_at DESC)',
  );
  // Org-wide view
  await knex.schema.raw(
    'CREATE INDEX idx_activity_logs_org ON activity_logs (org_id, created_at DESC)',
  );
  // Filter by actor
  await knex.schema.raw(
    'CREATE INDEX idx_activity_logs_actor ON activity_logs (actor_user_id, created_at DESC)',
  );
  // Filter by action type
  await knex.schema.raw(
    'CREATE INDEX idx_activity_logs_action ON activity_logs (action)',
  );
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('activity_logs');
};
