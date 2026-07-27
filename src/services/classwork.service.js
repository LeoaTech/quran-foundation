const repo        = require('../repositories/classwork.repository');
const coursesRepo = require('../repositories/courses.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');

// ── Helpers ────────────────────────────────────────────────────────────────────

function notFound(entity = 'Resource') {
  return new AppError('NOT_FOUND', `${entity} not found.`, 'مطلوبہ وسیلہ نہیں ملا۔', 404);
}

//  --------------Classwork Assignments -----------------------------
async function getSessionClassworkContext({ sessionId }) {
  const context = await repo.getTopicsUpToSession(sessionId);
  if (!context.session) throw notFound('Class Session');

  const presentStudents = await repo.getPresentStudentsBySession(sessionId);
  const sheet = await repo.getSheetBySession(sessionId);

  return {
    session: context.session,
    topics: context.topics,
    present_students: presentStudents,
    sheet,
  };
}

async function saveClassworkSheet({ user, sessionId, body }) {
  const context = await repo.getTopicsUpToSession(sessionId);
  if (!context.session) throw notFound('Class Session');

  await repo.upsertSheet({
    sessionId,
    topicId: body.topic_id,
    subtopicId: body.subtopic_id,
    description: body.description,
    entries: body.entries ?? [],
    userId: user.id,
  });

  activityLog.log({
    actor:       user,
    action:      'classwork_sheet.save',
    entity_type: 'classwork_sheets',
    entity_id:   sessionId,
    org_id:      user.org_id,
    summary_en:  `Saved classwork sheet for session`,
  }).catch(() => {});

  return repo.getSheetBySession(sessionId);
}

module.exports = {

  getSessionClassworkContext,
  saveClassworkSheet,
};

