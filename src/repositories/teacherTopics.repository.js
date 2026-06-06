const db = require('../db/knex');

function listTeacherTopics(centerId) {
  return db('center_teacher_topics as ctt')
    .join('users as u', 'u.id', 'ctt.teacher_user_id')
    .join('topics as t', 't.id', 'ctt.topic_id')
    .join('courses as c', 'c.id', 't.course_id')
    .where({ 'ctt.center_id': centerId, 'ctt.is_active': true })
    .select(
      'ctt.id',
      'ctt.center_id',
      'ctt.teacher_user_id',
      'u.full_name as teacher_name',
      'u.full_name_ur as teacher_name_ur',
      'ctt.topic_id',
      't.title as topic_title',
      't.title_ur as topic_title_ur',
      'c.id as course_id',
      'c.name as course_name',
      'c.name_ur as course_name_ur',
      'ctt.created_at'
    )
    .orderBy('c.name', 'asc')
    .orderBy('t.display_order', 'asc')
    .orderBy('u.full_name', 'asc');
}

function getAssignmentById(id) {
  return db('center_teacher_topics').where({ id }).first();
}

function getAssignment(centerId, teacherUserId, topicId) {
  return db('center_teacher_topics')
    .where({
      center_id: centerId,
      teacher_user_id: teacherUserId,
      topic_id: topicId
    })
    .first();
}

async function createAssignment(data) {
  const [row] = await db('center_teacher_topics')
    .insert(data)
    .returning('*');
  return row;
}

async function updateAssignment(id, data) {
  const [row] = await db('center_teacher_topics')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

module.exports = {
  listTeacherTopics,
  getAssignmentById,
  getAssignment,
  createAssignment,
  updateAssignment,
};
