// Dynamic RBAC layer on top of the static roles in 003_users_roles.
// Extends ROLES with management metadata, adds PERMISSIONS,
// ROLE_PERMISSIONS (role ↔ permission many-to-many), and
// USER_PERMISSIONS (per-user grant/deny overrides that win over role grants).

exports.up = async (knex) => {
  // ── 1. Extend ROLES ──────────────────────────────────────────────────────
  await knex.schema.alterTable('roles', (t) => {
    // System roles (super_admin, center_manager, teacher, student) may not be
    // deleted through the admin UI — only custom roles can be removed.
    t.boolean('is_system').notNullable().defaultTo(false);

    // Hex color for badges in the UI, e.g. '#1D9E75'. NULL = UI picks a default.
    t.string('color', 7).nullable();

    // Who created this role (null for seeded system roles).
    t.uuid('created_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
  });

  // ── 2. PERMISSIONS ───────────────────────────────────────────────────────
  // Flat permission registry. Each row is one fine-grained capability.
  // key follows "{module}.{action}" convention, e.g. "centers.create".
  await knex.schema.createTable('permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('key', 100).notNullable().unique();
    t.string('label', 255).notNullable();
    t.string('label_ur', 255);
    t.string('module', 50).notNullable();   // grouping key used by the admin UI
    t.string('action', 50).notNullable();   // verb within that module
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // ── 3. ROLE_PERMISSIONS ──────────────────────────────────────────────────
  // Which permissions a role has by default.
  await knex.schema.createTable('role_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    t.uuid('permission_id')
      .notNullable()
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    t.uuid('granted_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    t.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['role_id', 'permission_id']);
  });

  // ── 4. USER_PERMISSIONS ──────────────────────────────────────────────────
  // Per-user overrides that take precedence over role grants.
  // is_granted=true  → explicit GRANT  (user gets it even if their role doesn't).
  // is_granted=false → explicit DENY   (user loses it even if their role has it).
  await knex.schema.createTable('user_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.uuid('permission_id')
      .notNullable()
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    t.boolean('is_granted').notNullable();
    t.uuid('granted_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    t.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'permission_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('user_permissions');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');

  await knex.schema.alterTable('roles', (t) => {
    t.dropColumn('created_by');
    t.dropColumn('color');
    t.dropColumn('is_system');
  });
};
