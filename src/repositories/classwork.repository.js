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


/**
 * List all active content for a course, optionally filtered by level or topic.
 * Each row comes back with its nested words array.
 */
async function listContent({ courseId, courseLevelId, topicId } = {}) {
  const query = db('classwork_content as c')
    .leftJoin('topics as t', 't.id', 'c.topic_id')
    .leftJoin('course_levels as l', 'l.id', 'c.course_level_id')
    .where('c.course_id', courseId)
    .where('c.is_active', true)
    .select(
      'c.id',
      'c.course_id',
      'c.course_level_id',
      'l.title          as level_title',
      'l.title_ur       as level_title_ur',
      'c.topic_id',
      't.title          as topic_title',
      't.title_ur       as topic_title_ur',
      'c.surah_number',
      'c.ayah_number',
      'c.arabic_text',
      'c.label',
      'c.rule_marks',
      'c.total_marks',
      'c.created_by',
      'c.created_at',
    )
    .orderBy('c.created_at', 'asc');

  if (courseLevelId) query.where('c.course_level_id', courseLevelId);
  if (topicId) query.where('c.topic_id', topicId);

  const contentRows = await query;

  if (contentRows.length === 0) return [];

  // Batch-load words for all returned content rows
  const ids = contentRows.map((r) => r.id);
  const wordRows = await db('classwork_content_words')
    .whereIn('content_id', ids)
    .where('is_active', true)
    .orderBy('sequence_order', 'asc');

  const wordMap = new Map();
  for (const w of wordRows) {
    if (!wordMap.has(w.content_id)) wordMap.set(w.content_id, []);
    wordMap.get(w.content_id).push(w);
  }

  return contentRows.map((c) => ({
    ...c,
    rule_marks: typeof c.rule_marks === 'string' ? JSON.parse(c.rule_marks) : (c.rule_marks ?? {}),
    words: (wordMap.get(c.id) ?? []).map((w) => ({
      ...w,
      topic_ids:    typeof w.topic_ids === 'string' ? JSON.parse(w.topic_ids) : (w.topic_ids ?? []),
      rule_details: typeof w.rule_details === 'string' ? JSON.parse(w.rule_details) : (w.rule_details ?? []),
    })),
  }));
}

function getContentById(contentId) {
  return db('classwork_content').where({ id: contentId }).first();
}

async function createContent(data) {
  const [row] = await db('classwork_content').insert(data).returning('*');
  return row;
}




module.exports = {
  listCriteriaForTopics,
  listContent,
  getContentById,
  createContent
};
