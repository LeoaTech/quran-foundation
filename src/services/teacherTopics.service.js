const repo = require('../repositories/teacherTopics.repository');
const usersRepo = require('../repositories/users.repository');
const coursesRepo = require('../repositories/courses.repository');
const activityLog = require('./activityLog.service');
const { AppError } = require('../utils/errors');

function forbidden() {
  return new AppError(
    'FORBIDDEN',
    'You do not have access to perform this action.',
    'آپ کو یہ عمل کرنے کی اجازت نہیں ہے۔',
    403,
  );
}

function notFound(entity = 'Assignment') {
  return new AppError(
    'NOT_FOUND',
    `${entity} not found.`,
    'مطلوبہ ریکارڈ نہیں ملا۔',
    404,
  );
}

function assertCenterScope(user, targetCenterId) {
  if (user.roles.includes('super_admin')) return;
  if (!targetCenterId || user.center_id !== targetCenterId) {
    throw forbidden();
  }
}

async function listTeacherTopics({ user, centerId }) {
  assertCenterScope(user, centerId);
  return repo.listTeacherTopics(centerId);
}

async function createAssignment({ user, centerId, body }) {
  assertCenterScope(user, centerId);
  const { teacher_user_id, topic_id } = body;

  // 1. Verify teacher exists and is a teacher in this center
  const teacher = await usersRepo.getUserWithRoles(teacher_user_id);
  if (!teacher) {
    throw notFound('Teacher');
  }
  const isTeacherInCenter = teacher.roles.some(
    (r) => r.role === 'teacher' && r.center_id === centerId
  );
  if (!isTeacherInCenter) {
    throw new AppError(
      'VALIDATION_ERROR',
      'The selected user is not a teacher at this center.',
      'منتخب کردہ صارف اس مرکز میں استاد نہیں ہے۔',
      400
    );
  }

  // 2. Verify topic exists
  const topic = await coursesRepo.getTopicById(topic_id);
  if (!topic) {
    throw notFound('Topic');
  }

  // 3. Check for existing active assignment
  const existing = await repo.getAssignment(centerId, teacher_user_id, topic_id);
  if (existing) {
    if (existing.is_active) {
      throw new AppError(
        'CONFLICT',
        'This topic is already assigned to the teacher in this center.',
        'یہ موضوع پہلے ہی اس مرکز میں استاد کو تفویض کیا گیا ہے۔',
        409
      );
    } else {
      // Reactivate assignment
      const reactivated = await repo.updateAssignment(existing.id, { is_active: true });
      activityLog.log({
        actor: user,
        action: 'teacher_topic.assign',
        entity_type: 'center_teacher_topic',
        entity_id: reactivated.id,
        center_id: centerId,
        summary_en: `Reassigned topic "${topic.title}" to teacher "${teacher.full_name}"`,
      }).catch(() => {});
      return reactivated;
    }
  }

  const assignment = await repo.createAssignment({
    center_id: centerId,
    teacher_user_id,
    topic_id,
    is_active: true
  });

  activityLog.log({
    actor: user,
    action: 'teacher_topic.assign',
    entity_type: 'center_teacher_topic',
    entity_id: assignment.id,
    center_id: centerId,
    summary_en: `Assigned topic "${topic.title}" to teacher "${teacher.full_name}"`,
  }).catch(() => {});

  return assignment;
}

async function deleteAssignment({ user, centerId, assignmentId }) {
  assertCenterScope(user, centerId);

  const assignment = await repo.getAssignmentById(assignmentId);
  if (!assignment || assignment.center_id !== centerId) {
    throw notFound();
  }

  // Soft delete by deactivating
  await repo.updateAssignment(assignmentId, { is_active: false });

  activityLog.log({
    actor: user,
    action: 'teacher_topic.remove',
    entity_type: 'center_teacher_topic',
    entity_id: assignmentId,
    center_id: centerId,
    summary_en: `Removed topic assignment for teacher`,
  }).catch(() => {});
}

async function updateAssignment({ user, centerId, assignmentId, body }) {
  assertCenterScope(user, centerId);
  const { teacher_user_id, topic_id } = body;

  const assignment = await repo.getAssignmentById(assignmentId);
  if (!assignment || assignment.center_id !== centerId) {
    throw notFound();
  }

  // 1. Verify teacher exists and is a teacher in this center
  const teacher = await usersRepo.getUserWithRoles(teacher_user_id);
  if (!teacher) {
    throw notFound('Teacher');
  }
  const isTeacherInCenter = teacher.roles.some(
    (r) => r.role === 'teacher' && r.center_id === centerId
  );
  if (!isTeacherInCenter) {
    throw new AppError(
      'VALIDATION_ERROR',
      'The selected user is not a teacher at this center.',
      'منتخب کردہ صارف اس مرکز میں استاد نہیں ہے۔',
      400
    );
  }

  // 2. Verify topic exists
  const topic = await coursesRepo.getTopicById(topic_id);
  if (!topic) {
    throw notFound('Topic');
  }

  // 3. Check for existing active assignment (other than this one)
  const existing = await repo.getAssignment(centerId, teacher_user_id, topic_id);
  if (existing && existing.id !== assignmentId && existing.is_active) {
    throw new AppError(
      'CONFLICT',
      'This topic is already assigned to the teacher in this center.',
      'یہ موضوع پہلے ہی اس مرکز میں استاد کو تفویض کیا گیا ہے۔',
      409
    );
  }

  const updated = await repo.updateAssignment(assignmentId, {
    teacher_user_id,
    topic_id,
    is_active: true
  });

  activityLog.log({
    actor: user,
    action: 'teacher_topic.update',
    entity_type: 'center_teacher_topic',
    entity_id: assignmentId,
    center_id: centerId,
    summary_en: `Updated topic assignment: topic "${topic.title}" to teacher "${teacher.full_name}"`,
  }).catch(() => {});

  return updated;
}

module.exports = {
  listTeacherTopics,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
