exports.up = async (knex) => {
  await knex.schema.createTable('class_schedules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('class_id')
      .notNullable()
      .references('id')
      .inTable('classes')
      .onDelete('CASCADE');
    t.string('day_of_week', 20).notNullable(); // e.g. "Monday", "Tuesday", etc.
    t.time('start_time').notNullable();
    t.time('end_time').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // Migrate existing schedule_days and start_time from classes table
  const classes = await knex('classes').select('id', 'schedule_days', 'start_time');
  for (const cls of classes) {
    if (!cls.schedule_days || !cls.start_time) continue;
    const days = cls.schedule_days.split(',').map(d => d.trim()).filter(Boolean);
    for (const day of days) {
      // Capitalize day (e.g. "monday" -> "Monday")
      const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
      
      // Calculate a default end time (start_time + 3 hours)
      let endTime = null;
      try {
        const [hours, minutes] = cls.start_time.split(':');
        const startHrs = parseInt(hours, 10);
        const endHrs = (startHrs + 3) % 24;
        endTime = `${String(endHrs).padStart(2, '0')}:${minutes || '00'}:00`;
      } catch (e) {
        endTime = null;
      }

      await knex('class_schedules').insert({
        class_id: cls.id,
        day_of_week: capitalizedDay,
        start_time: cls.start_time,
        end_time: endTime,
      });
    }
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('class_schedules');
};
