// import_jobs: tracks async bulk student import jobs.
// import_errors: stores per-row errors for paginated review and error report generation.

exports.up = async (knex) => {
  await knex.schema.createTable('import_jobs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('center_id')
      .notNullable()
      .references('id')
      .inTable('centers')
      .onDelete('RESTRICT');
    t.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('status', 30).notNullable().defaultTo('queued'); // queued | processing | completed | failed
    t.string('storage_key', 500);         //temp path for import file
    t.string('error_report_key', 500);    //  temp path for error report file
    t.string('file_name', 255);           // original uploaded filename
    t.string('file_format', 10);          // xlsx | csv — used by error report generator
    t.integer('total_student_rows').notNullable().defaultTo(0);
    t.integer('total_enrollment_rows').notNullable().defaultTo(0);
    t.integer('processed_student_rows').notNullable().defaultTo(0);
    t.integer('processed_enrollment_rows').notNullable().defaultTo(0);
    t.integer('students_created').notNullable().defaultTo(0);
    t.integer('students_reused').notNullable().defaultTo(0);
    t.integer('enrollments_created').notNullable().defaultTo(0);
    t.integer('fees_recorded').notNullable().defaultTo(0);
    t.integer('skip_count').notNullable().defaultTo(0);
    t.integer('error_count').notNullable().defaultTo(0);
    t.integer('image_queued').notNullable().defaultTo(0);
    t.integer('image_done').notNullable().defaultTo(0);
    t.integer('image_failed').notNullable().defaultTo(0);
    t.text('failed_reason');              // only for fatal job-level failures
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('import_errors', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('import_job_id')
      .notNullable()
      .references('id')
      .inTable('import_jobs')
      .onDelete('CASCADE');
    t.string('sheet_name', 50);           // Students | Enrollments | Image
    t.integer('row_number');
    t.string('student_ref', 100);
    t.string('student_name', 255);
    t.string('phone', 50);
    t.text('error_message');
    t.jsonb('row_data');                  // original cell values for error report generation
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('import_errors');
  await knex.schema.dropTableIfExists('import_jobs');
};
