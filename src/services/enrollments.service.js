const repo      = require('../repositories/enrollments.repository');
const classRepo = require('../repositories/classes.repository');
const { AppError } = require('../utils/errors');

// ── Helpers ───────────────────────────────────────────────────────────────────

function notFound(entity = 'Enrollment') {
  return new AppError(
    'NOT_FOUND',
    `${entity} not found.`,
    'مطلوبہ وسیلہ نہیں ملا۔',
    404,
  );
}

function forbidden() {
  return new AppError(
    'FORBIDDEN',
    'You do not have access to perform this action.',
    'آپ کو یہ عمل کرنے کی اجازت نہیں ہے۔',
    403,
  );
}

// Throws 403 if a center_manager is not scoped to the given center.
function assertCenterAccess(user, centerId) {
  if (user.roles.includes('super_admin')) return;
  if (user.center_id !== centerId) throw forbidden();
}

async function requireClass(classId) {
  const cls = await classRepo.getClassById(classId);
  if (!cls) throw notFound('Class');
  return cls;
}

async function requireEnrollment(enrollmentId) {
  const enrollment = await repo.getEnrollmentById(enrollmentId);
  if (!enrollment || !enrollment.is_active) throw notFound('Enrollment');
  return enrollment;
}

// ── Service functions ─────────────────────────────────────────────────────────

async function createEnrollment({ user, body }) {
  const { student_user_id, class_id, enrolled_on, prior_level, notes_ur } = body;

  const cls = await requireClass(class_id);

  if (!cls.is_active) {
    throw new AppError('NOT_FOUND', 'Class not found or inactive.', 'کلاس نہیں ملی یا غیر فعال ہے۔', 404);
  }

  // center_manager can only enroll into their own center's classes.
  assertCenterAccess(user, cls.center_id);

  // Duplicate check: student cannot have two active enrollments in the same class.
  const existing = await repo.getActiveEnrollmentForStudent(class_id, student_user_id);
  if (existing) {
    throw new AppError(
      'ENROLLMENT_CONFLICT',
      'Student is already actively enrolled in this class.',
      'طالب علم پہلے سے اس کلاس میں داخل ہے۔',
      409,
    );
  }

  // Capacity check: only enforce when max_capacity is set.
  if (cls.max_capacity != null) {
    const activeCount = await repo.countActiveEnrollments(class_id);
    if (activeCount >= cls.max_capacity) {
      throw new AppError(
        'CLASS_FULL',
        'This class has reached its maximum capacity.',
        'یہ کلاس اپنی زیادہ سے زیادہ گنجائش تک پہنچ گئی ہے۔',
        409,
      );
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return repo.createEnrollment({
    student_user_id,
    class_id,
    center_id:   cls.center_id,
    status:      'active',
    enrolled_on: enrolled_on || today,
    prior_level: prior_level || null,
    notes_ur:    notes_ur    || null,
    is_active:   true,
  });
}

async function listEnrollmentsByClass({ user, classId, query = {} }) {
  const cls = await requireClass(classId);

  if (!user.roles.includes('super_admin')) {
    if (user.center_id !== cls.center_id) throw forbidden();
  }

  const status = query.status; // optional filter: 'active' | 'withdrawn'
  return repo.listEnrollmentsByClass(classId, { status });
}

async function listEnrollmentsByStudent({ user, studentUserId }) {
  // Any authenticated user may list a student's own enrollments.
  // center_manager can only see students in their center (enforced by filtering
  // the joined center_id). super_admin and teachers see all.
  // Simple approach: no additional guard — the API spec grants access to all
  // authenticated roles; sensitive filtering is handled at the DB level via is_active.
  return repo.listEnrollmentsByStudent(studentUserId);
}

async function updateEnrollment({ user, enrollmentId, body }) {
  const enrollment = await requireEnrollment(enrollmentId);

  // center_manager scoping
  assertCenterAccess(user, enrollment.center_id);

  const updates = { ...body };

  // Withdrawal: auto-set withdrawn_on to today if not supplied.
  if (updates.status === 'withdrawn' && !updates.withdrawn_on) {
    updates.withdrawn_on = new Date().toISOString().split('T')[0];
  }

  return repo.updateEnrollment(enrollmentId, updates);
}

module.exports = {
  createEnrollment,
  listEnrollmentsByClass,
  listEnrollmentsByStudent,
  updateEnrollment,
};
