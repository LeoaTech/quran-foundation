const db = require('../db/knex');

// ── Courses ────────────────────────────────────────────────────────────────────

function listCourses({ isActive } = {}) {
  const query = db('courses').orderBy('name', 'asc');
  if (isActive !== undefined) query.where({ is_active: isActive });
  return query;
}

function getCourseById(courseId) {
  return db('courses').where({ id: courseId }).first();
}

async function createCourse(data) {
  const [row] = await db('courses').insert(data).returning('*');
  return row;
}

async function updateCourse(courseId, data) {
  const [row] = await db('courses')
    .where({ id: courseId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Course Levels ──────────────────────────────────────────────────────────────

function listLevelsByCourse(courseId) {
  return db('course_levels')
    .where({ course_id: courseId, is_active: true })
    .orderBy('level_order', 'asc');
}

async function createLevel(data) {
  const [row] = await db('course_levels').insert(data).returning('*');
  return row;
}

// ── Topics ────────────────────────────────────────────────────────────────────

// Returns topics with subtopics nested. Uses a single left-join query
// then groups in JS to avoid N+1 queries.
async function getTopicsWithSubtopics(courseId) {
  const rows = await db('topics as t')
    .leftJoin('topic_subtopics as s', function () {
      this.on('s.topic_id', '=', 't.id').andOnVal('s.is_active', '=', true);
    })
    .where('t.course_id', courseId)
    .where('t.is_active', true)
    .select(
      't.id          as topic_id',
      't.title       as topic_title',
      't.title_ur    as topic_title_ur',
      't.title_ar    as topic_title_ar',
      't.description_ur as topic_description_ur',
      't.display_order  as topic_display_order',
      't.created_by     as topic_created_by',
      't.created_at     as topic_created_at',
      's.id             as sub_id',
      's.title          as sub_title',
      's.title_ur       as sub_title_ur',
      's.title_ar       as sub_title_ar',
      's.display_order  as sub_display_order',
    )
    .orderBy('t.display_order', 'asc')
    .orderBy('s.display_order', 'asc');

  const topicMap = new Map();
  for (const row of rows) {
    if (!topicMap.has(row.topic_id)) {
      topicMap.set(row.topic_id, {
        id:             row.topic_id,
        title:          row.topic_title,
        title_ur:       row.topic_title_ur,
        title_ar:       row.topic_title_ar,
        description_ur: row.topic_description_ur,
        display_order:  row.topic_display_order,
        created_by:     row.topic_created_by,
        created_at:     row.topic_created_at,
        subtopics:      [],
      });
    }
    if (row.sub_id) {
      topicMap.get(row.topic_id).subtopics.push({
        id:            row.sub_id,
        title:         row.sub_title,
        title_ur:      row.sub_title_ur,
        title_ar:      row.sub_title_ar,
        display_order: row.sub_display_order,
      });
    }
  }

  return Array.from(topicMap.values());
}

function getTopicById(topicId) {
  return db('topics').where({ id: topicId }).first();
}

async function createTopic(data) {
  const [row] = await db('topics').insert(data).returning('*');
  return row;
}

async function updateTopic(topicId, data) {
  const [row] = await db('topics')
    .where({ id: topicId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// Soft delete — sets is_active=false, never deletes the row.
async function deactivateTopic(topicId) {
  const [row] = await db('topics')
    .where({ id: topicId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

// ── Subtopics ─────────────────────────────────────────────────────────────────

function getSubtopicById(subtopicId) {
  return db('topic_subtopics').where({ id: subtopicId }).first();
}

async function createSubtopic(data) {
  const [row] = await db('topic_subtopics').insert(data).returning('*');
  return row;
}

async function updateSubtopic(subtopicId, data) {
  const [row] = await db('topic_subtopics')
    .where({ id: subtopicId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

async function deactivateSubtopic(subtopicId) {
  const [row] = await db('topic_subtopics')
    .where({ id: subtopicId })
    .update({ is_active: false, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

module.exports = {
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  listLevelsByCourse,
  createLevel,
  getTopicsWithSubtopics,
  getTopicById,
  createTopic,
  updateTopic,
  deactivateTopic,
  getSubtopicById,
  createSubtopic,
  updateSubtopic,
  deactivateSubtopic,
};
