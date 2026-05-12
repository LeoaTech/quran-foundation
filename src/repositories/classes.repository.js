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
      'cl.title as course_level_title',
      db.raw('COUNT(e.id)::int as enrolled_count')
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
    .join('class_teachers as ct', function () {
      this.on('ct.class_id', '=', 'c.id').andOnVal('ct.is_active', '=', true);
    })
    .leftJoin('enrollments as e', function() {
      this.on('e.class_id', '=', 'c.id')
          .andOnVal('e.status', '=', 'active')
          .andOnVal('e.is_active', '=', true);
    })
    .where('c.center_id', centerId)
    .where('ct.teacher_user_id', teacherUserId)
    .orderBy('c.name', 'asc')
    .select(
      'c.*',
      'cr.name as course_name',
      'cr.type as course_type',
      'cl.title as course_level_title',
      db.raw('COUNT(e.id)::int as enrolled_count')
    )
    .groupBy('c.id', 'cr.id', 'cl.id', 'ct.id');
    
  if (courseId !== undefined) query.where('c.course_id', courseId);
  if (isActive !== undefined) query.where('c.is_active', isActive);
  return query;
}

function getClassById(classId) {
  return db('classes').where({ id: classId }).first();
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

module.exports = {
  listClasses,
  listClassesForTeacher,
  getClassById,
  createClass,
  updateClass,
  listTeachers,
  getClassTeacherEntry,
  getClassTeacherById,
  assignTeacher,
  deactivateTeacher,
  listCriteria,
  getCriteriaById,
  createCriteria,
  updateCriteria,
  deactivateCriteria,
};
