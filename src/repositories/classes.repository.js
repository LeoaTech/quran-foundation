const db = require('../db/knex');

// ── Classes ───────────────────────────────────────────────────────────────────

function listClasses(centerId, { courseId, isActive } = {}) {
  const query = db('classes as c')
    .join('courses as cr', 'cr.id', 'c.course_id')
    .leftJoin('course_levels as cl', 'cl.id', 'c.course_level_id')
    .leftJoin('enrollments as e', function() {
      this.on('e.class_id', '=', 'c.id')
          .andOnVal('e.status', '=', 'active')
          .andOnVal('e.is_active', '=', true);
    })
    .where('c.center_id', centerId)
    .select(
      'c.*',
      'cr.name as course_name',
      'cr.type as course_type',
      'cr.duration_months as course_duration_months',
      'cl.title as course_level_title',
      db.raw('COUNT(e.id)::int as enrolled_count'),
      // Aggregate teacher names from topic assignments for this class's course + center
      db.raw(`
        (SELECT STRING_AGG(DISTINCT u.full_name, ', ' ORDER BY u.full_name)
         FROM center_teacher_topics ctt
         JOIN users u ON u.id = ctt.teacher_user_id
         JOIN topics t ON t.id = ctt.topic_id
         WHERE ctt.center_id = c.center_id
           AND t.course_id = c.course_id
           AND ctt.is_active = true) as assigned_teachers
      `),
      db.raw(`
        (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('id', cs.id, 'day_of_week', cs.day_of_week, 'start_time', cs.start_time, 'end_time', cs.end_time)), '[]'::json)
         FROM class_schedules cs
         WHERE cs.class_id = c.id AND cs.is_active = true) as schedules
      `)
    )
    .groupBy('c.id', 'cr.id', 'cl.id')
    .orderBy('c.name', 'asc');
    
  if (courseId  !== undefined) query.where('c.course_id', courseId);
  if (isActive  !== undefined) query.where('c.is_active', isActive);
  return query;
}

// Returns only the classes a specific teacher is assigned to within a center.
function listClassesForTeacher(centerId, teacherUserId, { courseId, isActive } = {}) {
  const query = db('classes as c')
    .join('courses as cr', 'cr.id', 'c.course_id')
    .leftJoin('course_levels as cl', 'cl.id', 'c.course_level_id')
    .leftJoin('class_teachers as ct', function () {
      this.on('ct.class_id', '=', 'c.id')
          .andOnVal('ct.is_active', '=', true)
          .andOnVal('ct.teacher_user_id', '=', teacherUserId);
    })
    .leftJoin('enrollments as e', function() {
      this.on('e.class_id', '=', 'c.id')
          .andOnVal('e.status', '=', 'active')
          .andOnVal('e.is_active', '=', true);
    })
    .where('c.center_id', centerId)
    .where(function() {
      this.whereNotNull('ct.id')
          .orWhereExists(function() {
            this.select('*')
                .from('center_teacher_topics as ctt')
                .join('topics as t', 't.id', 'ctt.topic_id')
                .whereRaw('ctt.center_id = c.center_id')
                .whereRaw('t.course_id = c.course_id')
                .where('ctt.teacher_user_id', teacherUserId)
                .where('ctt.is_active', true);
          });
    })
    .orderBy('c.name', 'asc')
    .select(
      'c.*',
      'cr.name as course_name',
      'cr.type as course_type',
      'cr.duration_months as course_duration_months',
      'cl.title as course_level_title',
      db.raw('COUNT(e.id)::int as enrolled_count'),
      db.raw(`
        (SELECT STRING_AGG(DISTINCT u2.full_name, ', ' ORDER BY u2.full_name)
         FROM center_teacher_topics ctt2
         JOIN users u2 ON u2.id = ctt2.teacher_user_id
         JOIN topics t2 ON t2.id = ctt2.topic_id
         WHERE ctt2.center_id = c.center_id
           AND t2.course_id = c.course_id
           AND ctt2.is_active = true) as assigned_teachers
      `),
      db.raw(`
        (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('id', cs.id, 'day_of_week', cs.day_of_week, 'start_time', cs.start_time, 'end_time', cs.end_time)), '[]'::json)
         FROM class_schedules cs
         WHERE cs.class_id = c.id AND cs.is_active = true) as schedules
      `)
    )
    .groupBy('c.id', 'cr.id', 'cl.id');
    
  if (courseId !== undefined) query.where('c.course_id', courseId);
  if (isActive !== undefined) query.where('c.is_active', isActive);
  return query;
}

function getClassById(classId) {
  return db('classes as c')
    .leftJoin('courses as cr', 'cr.id', 'c.course_id')
    .where('c.id', classId)
    .select(
      'c.*', 
      'cr.name as course_name', 
      'cr.difficulty_level as course_difficulty_level',
      'cr.duration_months as course_duration_months',
      db.raw(`
        (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('id', cs.id, 'day_of_week', cs.day_of_week, 'start_time', cs.start_time, 'end_time', cs.end_time)), '[]'::json)
         FROM class_schedules cs
         WHERE cs.class_id = c.id AND cs.is_active = true) as schedules
      `)
    )
    .first();
}

async function createClass(data) {
  const [row] = await db('classes').insert(data).returning('*');
  return row;
}

async function updateClass(classId, data) {
  const [row] = await db('classes')
    .where({ id: classId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Class Teachers ────────────────────────────────────────────────────────────

function listTeachers(classId) {
  return db('class_teachers as ct')
    .join('users as u', 'u.id', 'ct.teacher_user_id')
    .where('ct.class_id', classId)
    .where('ct.is_active', true)
    .select(
      'ct.id as class_teacher_id',
      'ct.is_primary',
      'ct.assigned_from',
      'u.id as teacher_user_id',
      'u.full_name',
      'u.full_name_ur',
      'u.phone',
    )
    .orderBy('ct.is_primary', 'desc')
    .orderBy('ct.assigned_from', 'asc');
}

// Check whether a user is an active teacher of this class.
function getClassTeacherEntry(classId, teacherUserId) {
  return db('class_teachers')
    .where({ class_id: classId, teacher_user_id: teacherUserId, is_active: true })
    .first();
}

// Check whether a user has any active topic assignments for a given course in a center
async function hasTeacherTopicAccess(centerId, courseId, teacherUserId) {
  const result = await db('center_teacher_topics as ctt')
    .join('topics as t', 't.id', 'ctt.topic_id')
    .where({
      'ctt.center_id': centerId,
      't.course_id': courseId,
      'ctt.teacher_user_id': teacherUserId,
      'ctt.is_active': true
    })
    .select(db.raw('1'))
    .first();
  return !!result;
}

// Get a class_teachers row by its own PK (used for DELETE).
function getClassTeacherById(classTeacherId) {
  return db('class_teachers').where({ id: classTeacherId }).first();
}

async function assignTeacher(data) {
  const [row] = await db('class_teachers').insert(data).returning('*');
  return row;
}

// Soft-remove a teacher from a class — sets is_active=false, never deletes the row.
async function deactivateTeacher(classTeacherId) {
  const [row] = await db('class_teachers')
    .where({ id: classTeacherId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Homework Criteria ─────────────────────────────────────────────────────────

// Joins with topics so the response can include topic_title_ur as the API spec shows.
function listCriteria(classId, { includeInactive = false } = {}) {
  const query = db('homework_criteria as hc')
    .leftJoin('topics as t', 't.id', 'hc.topic_id')
    .where('hc.class_id', classId)
    .select(
      'hc.id',
      'hc.label',
      'hc.label_ur',
      'hc.topic_id',
      't.title_ur as topic_title_ur',
      'hc.subtopic_id',
      'hc.max_marks',
      'hc.display_order',
      'hc.is_active',
    )
    .orderBy('hc.display_order', 'asc');
  if (!includeInactive) query.where('hc.is_active', true);
  return query;
}

function getCriteriaById(criteriaId) {
  return db('homework_criteria').where({ id: criteriaId }).first();
}

async function createCriteria(data) {
  const [row] = await db('homework_criteria').insert(data).returning('*');
  return row;
}

async function updateCriteria(criteriaId, data) {
  const [row] = await db('homework_criteria')
    .where({ id: criteriaId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// NEVER hard-deletes. Sets is_active=false.
// Existing homework_scores referencing this criteria_id are preserved for historical accuracy.
async function deactivateCriteria(criteriaId) {
  const [row] = await db('homework_criteria')
    .where({ id: criteriaId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Class Schedules ───────────────────────────────────────────────────────────

function listSchedules(classId) {
  return db('class_schedules')
    .where({ class_id: classId, is_active: true })
    .orderByRaw("CASE day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7 ELSE 8 END")
    .orderBy('start_time', 'asc');
}

function getScheduleById(scheduleId) {
  return db('class_schedules').where({ id: scheduleId }).first();
}

async function createSchedule(data) {
  const [row] = await db('class_schedules').insert(data).returning('*');
  return row;
}

async function deactivateSchedule(scheduleId) {
  const [row] = await db('class_schedules')
    .where({ id: scheduleId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Class Session Plans (topic per projected class) ───────────────────────────

function listSessionPlans(classId) {
  return db('class_session_plans as p')
    .leftJoin('topics as t', 't.id', 'p.topic_id')
    .where({ 'p.class_id': classId, 'p.is_active': true })
    .select(
      'p.*',
      't.title as syllabus_topic_title',
      't.title_ur as syllabus_topic_title_ur',
    )
    .orderBy('p.session_date', 'asc');
}

async function upsertSessionPlan(classId, data) {
  const existing = await db('class_session_plans')
    .where({
      class_id: classId,
      session_date: data.session_date,
      schedule_id: data.schedule_id ?? null,
    })
    .first();

  const payload = {
    topic_id: data.topic_id ?? null,
    topic_title: data.topic_title ?? null,
    topic_title_ur: data.topic_title_ur ?? null,
    is_active: true,
    updated_at: db.fn.now(),
  };

  if (existing) {
    const [row] = await db('class_session_plans')
      .where({ id: existing.id })
      .update(payload)
      .returning('*');
    return row;
  }

  const [row] = await db('class_session_plans')
    .insert({
      class_id: classId,
      session_date: data.session_date,
      schedule_id: data.schedule_id ?? null,
      ...payload,
    })
    .returning('*');
  return row;
}

module.exports = {
  listClasses,
  listClassesForTeacher,
  getClassById,
  createClass,
  updateClass,
  listTeachers,
  getClassTeacherEntry,
  hasTeacherTopicAccess,
  getClassTeacherById,
  assignTeacher,
  deactivateTeacher,
  listCriteria,
  getCriteriaById,
  createCriteria,
  updateCriteria,
  deactivateCriteria,
  listSchedules,
  getScheduleById,
  createSchedule,
  deactivateSchedule,
  listSessionPlans,
  upsertSessionPlan,
};
