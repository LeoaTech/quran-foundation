const db = require('../db/knex');

// ── course_classwork_criteria helpers ─────────────────────────────────────────

/**
 * Fetch all active criteria for a list of topic IDs within a course.
 * Returns rows with subtopic info joined.
 */
async function listCriteriaForTopics({ courseId, topicIds = [] }) {
  if (!topicIds.length) return [];
  return db('course_classwork_criteria as c')
    .leftJoin('topic_subtopics as s', 's.id', 'c.subtopic_id')
    .where('c.course_id', courseId)
    .whereIn('c.topic_id', topicIds)
    .where('c.is_active', true)
    .select(
      'c.id',
      'c.course_id',
      'c.topic_id',
      'c.subtopic_id',
      's.title       as subtopic_title',
      's.title_ur    as subtopic_title_ur',
      'c.label',
      'c.label_ur',
      'c.max_marks',
      'c.display_order',
    )
    .orderBy(['c.topic_id', 'c.display_order']);
}

// ── classwork_content ─────────────────────────────────────────────────────────



async function createContent(data) {
  const [row] = await db('classwork_content').insert(data).returning('*');
  return row;
}


module.exports = {
  listCriteriaForTopics,
  createContent
};
