const repo      = require('../repositories/enrollments.repository');
const classRepo = require('../repositories/classes.repository');
const financeRepo = require('../repositories/finance.repository');
const activityLog = require('./activityLog.service');
const reportCache = require('../utils/reportCache');
const db        = require('../db/knex');
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
  if (String(user.center_id) !== String(centerId)) throw forbidden();
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
  const { student_user_id, class_id, class_schedule_id, enrolled_on, prior_level, notes_ur, amount_paid, payment_method } = body;

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

  const result = await db.transaction(async (trx) => {
    const enrollment = await repo.createEnrollment({
      student_user_id,
      class_id,
      class_schedule_id: class_schedule_id || null,
      center_id:   cls.center_id,
      status:      'active',
      enrolled_on: enrolled_on || today,
      prior_level: prior_level || null,
      notes_ur:    notes_ur    || null,
      is_active:   true,
    }, trx);

    if (amount_paid != null) {
      await financeRepo.createFeePayment({
        enrollment_id: enrollment.id,
        amount_paid,
        payment_method: payment_method || 'cash',
        received_by_user_id: user.id,
        center_id: cls.center_id,
        payment_date: today,
      }, trx);
    }

    return enrollment;
  });

  const student = await db('users').where({ id: student_user_id }).first();
  const studentName = student ? student.full_name : 'Unknown Student';

  activityLog.log({
    actor:       user,
    action:      'enrollment.create',
    entity_type: 'enrollment',
    entity_id:   result.id,
    center_id:   cls.center_id,
    summary_en:  `Enrolled student ${studentName} into ${cls.name}`,
    metadata:    { student_user_id, class_id },
  }).catch(() => {});

  if (amount_paid != null) {
    activityLog.log({
      actor:       user,
      action:      'payment.collect',
      entity_type: 'enrollment',
      entity_id:   result.id,
      center_id:   cls.center_id,
      summary_en:  `${user.full_name || 'System'} collected fee ${amount_paid} PKR for enrollment in ${cls.name}`,
      metadata:    { amount_paid, payment_method: payment_method || 'cash' },
    }).catch(() => {});
  }

  await reportCache.invalidateCenterReports(cls.center_id).catch(() => {});

  return result;
}

// ── Enroll New Student (transactional) ────────────────────────────────────────
// Creates a new user, assigns the 'student' role, and enrolls them into a class
// — all inside a single DB transaction. If ANY step fails the entire operation
// is rolled back so there are no orphan users or partial data.

async function enrollNewStudent({ user, body }) {
  const {
    full_name, full_name_ur, phone, whatsapp, date_of_birth, gender,
    is_minor, guardian_name, guardian_phone, guardian_relation,
    class_id, class_schedule_id, enrolled_on, prior_level, notes_ur, amount_paid, payment_method,
    profile_picture, qualification, occupation, marital_status, is_repeater, address, center_manager_name, center_manager_contact
  } = body;

  // ── Pre-flight checks (outside transaction — read-only) ─────────────────
  const cls = await requireClass(class_id);

  if (!cls.is_active) {
    throw new AppError('NOT_FOUND', 'Class not found or inactive.', 'کلاس نہیں ملی یا غیر فعال ہے۔', 404);
  }

  // center_manager may only enroll into their own center's classes.
  assertCenterAccess(user, cls.center_id);

  // Capacity check
  if (cls.max_capacity != null) {
    const activeCount = await repo.countActiveEnrollments(class_id);
    if (activeCount >= cls.max_capacity) {
      throw new AppError('CLASS_FULL', 'This class has reached its maximum capacity.', 'یہ کلاس اپنی زیادہ سے زیادہ گنجائش تک پہنچ گئی ہے۔', 409);
    }
  }

  // For ADULT students: check phone uniqueness.
  // For MINOR students: no phone on their record — guardian phone is used for contact.
  if (!is_minor) {
    if (phone) {
      const existingUser = await db('users').where({ phone }).first();
      if (existingUser) {
        // Check if this user is already enrolled in this class
        const existingEnrollment = await repo.getActiveEnrollmentForStudent(class_id, existingUser.id);
        if (existingEnrollment) {
          throw new AppError('ENROLLMENT_CONFLICT', 'A student with this phone is already enrolled in this class.', 'اس فون نمبر والا طالب علم پہلے سے اس کلاس میں داخل ہے۔', 409);
        }
        throw new AppError('USER_EXISTS', `A user with phone ${phone} already exists (${existingUser.full_name}). Use the standard enrollment endpoint with their user ID.`, 'اس فون نمبر کا صارف پہلے سے موجود ہے۔', 409);
      }
    }
  }

  // ── Transactional block ─────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const tempPassword = `Qf${require('crypto').randomBytes(4).toString('hex')}`;
  const password_hash = await require('bcryptjs').hash(tempPassword, 10);

  const result = await db.transaction(async (trx) => {
    // 1. Create the student user
    // Minor students have phone = null; their guardian holds the contact number.
    const [newUser] = await trx('users').insert({
      full_name,
      full_name_ur: full_name_ur || null,
      email:        null,
      phone:        is_minor ? null : (phone || null),
      whatsapp:     is_minor ? null : (whatsapp || phone || null),
      date_of_birth: date_of_birth || null,
      gender:       gender || null,
      password_hash,
      preferred_lang: 'ur',
      is_active:    true,
      is_minor:     is_minor || false,
      metadata:     JSON.stringify({
        profile_picture: profile_picture || null,
        qualification: qualification || null,
        occupation: occupation || null,
        marital_status: marital_status || null,
        is_repeater: is_repeater || false,
        address: address || null,
        center_manager_name: center_manager_name || null,
        center_manager_contact: center_manager_contact || null,
      }),
    }).returning('*');

    // 2. Assign the 'student' role scoped to this center
    const roleRow = await trx('roles').where({ name: 'student' }).first();
    if (!roleRow) throw new Error("Role 'student' not found in roles table.");

    await trx('user_roles').insert({
      user_id:   newUser.id,
      role_id:   roleRow.id,
      center_id: cls.center_id,
    });

    // 3. For minor students — create/find the guardian user and link them.
    if (is_minor && guardian_phone) {
      let guardianUser = await trx('users').where({ phone: guardian_phone }).first();

      if (!guardianUser) {
        // Guardian doesn't have an account yet — create one automatically.
        const gName = guardian_name || 'Guardian';
        const gPassword = `Qf${require('crypto').randomBytes(4).toString('hex')}`;
        const gHash = await require('bcryptjs').hash(gPassword, 10);

        const [newGuardian] = await trx('users').insert({
          full_name: gName,
          phone: guardian_phone,
          whatsapp: guardian_phone,
          password_hash: gHash,
          preferred_lang: 'ur',
          is_active: true,
          is_minor: false,
        }).returning('*');

        // Assign 'guardian' role scoped to this center
        const guardianRoleRow = await trx('roles').where({ name: 'guardian' }).first();
        if (guardianRoleRow) {
          await trx('user_roles').insert({
            user_id: newGuardian.id,
            role_id: guardianRoleRow.id,
            center_id: cls.center_id,
          }).onConflict(['user_id', 'role_id', 'center_id']).ignore();
        }

        guardianUser = newGuardian;
      }

      // Link student → guardian in the guardians table
      await trx('guardians').insert({
        student_user_id: newUser.id,
        guardian_user_id: guardianUser.id,
        relation: guardian_relation || null,
        is_primary: true,
      }).onConflict(['student_user_id', 'guardian_user_id']).ignore();
    }

    // 4. Create the enrollment
    const [enrollment] = await trx('enrollments').insert({
      student_user_id: newUser.id,
      class_id,
      class_schedule_id: class_schedule_id || null,
      center_id:   cls.center_id,
      status:      'active',
      enrolled_on: enrolled_on || today,
      prior_level: prior_level || null,
      notes_ur:    notes_ur || null,
      is_active:   true,
    }).returning('*');

    if (amount_paid != null) {
      await financeRepo.createFeePayment({
        enrollment_id: enrollment.id,
        amount_paid,
        payment_method: payment_method || 'cash',
        received_by_user_id: user.id,
        center_id: cls.center_id,
        payment_date: today,
      }, trx);
    }

    return { user: newUser, enrollment, temp_password: tempPassword };
  });

  const responseData = {
    student: {
      id:        result.user.id,
      full_name: result.user.full_name,
      phone:     result.user.phone,
      is_minor:  result.user.is_minor,
      temp_password: result.temp_password,
    },
    enrollment: result.enrollment,
  };

  activityLog.log({
    actor:       user,
    action:      'enrollment.create',
    entity_type: 'enrollment',
    entity_id:   result.enrollment.id,
    center_id:   result.enrollment.center_id,
    summary_en:  `Enrolled ${is_minor ? 'minor ' : ''}student ${result.user.full_name} into ${cls.name}`,
    metadata:    { student_name: result.user.full_name, class_id, is_minor: is_minor || false },
  }).catch(() => {});

  if (amount_paid != null) {
    activityLog.log({
      actor:       user,
      action:      'payment.collect',
      entity_type: 'enrollment',
      entity_id:   result.enrollment.id,
      center_id:   result.enrollment.center_id,
      summary_en:  `${user.full_name || 'System'} collected fee ${amount_paid} PKR for enrollment in ${cls.name}`,
      metadata:    { amount_paid, payment_method: payment_method || 'cash' },
    }).catch(() => {});
  }

  await reportCache.invalidateCenterReports(result.enrollment.center_id).catch(() => {});

  return responseData;
}

async function listEnrollmentsByClass({ user, classId, query = {} }) {
  const cls = await requireClass(classId);

  if (!user.roles.includes('super_admin')) {
    if (String(user.center_id) !== String(cls.center_id)) throw forbidden();
  }

  const status = query.status; // optional filter: 'active' | 'withdrawn'
  return repo.listEnrollmentsByClass(classId, { status });
}

async function listEnrollmentsByCenter({ user, centerId, query = {} }) {
  assertCenterAccess(user, centerId);
  const status = query.status;
  return repo.listEnrollmentsByCenter(centerId, { status });
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

  const updated = await repo.updateEnrollment(enrollmentId, updates);
  const student = await db('users').where({ id: enrollment.student_user_id }).first();
  activityLog.log({
    actor:       user,
    action:      'enrollment.update',
    entity_type: 'enrollment',
    entity_id:   enrollmentId,
    center_id:   enrollment.center_id,
    summary_en:  `Updated enrollment status for ${student?.full_name || 'Student'} to "${updates.status || enrollment.status}"`,
    metadata:    { enrollment_id: enrollmentId, status: updates.status || enrollment.status },
  }).catch(() => {});

  await reportCache.invalidateCenterReports(enrollment.center_id).catch(() => {});

  return updated;
}

module.exports = {
  createEnrollment,
  enrollNewStudent,
  listEnrollmentsByClass,
  listEnrollmentsByCenter,
  listEnrollmentsByStudent,
  updateEnrollment,
};
