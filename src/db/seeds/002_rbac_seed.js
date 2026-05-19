// Seed: dynamic RBAC baseline
//
// 1. Ensures the four system roles exist and marks them is_system = true.
// 2. Inserts all permissions for every module in the system.
// 3. Assigns permissions to system roles as per the spec.
//
// Safe to run multiple times — all inserts use onConflict().ignore().

// ─── Role definitions ────────────────────────────────────────────────────────

const SYSTEM_ROLES = [
  { name: 'super_admin', description: 'Full access to all centers and org settings', color: '#3C3489', is_system: true },
  { name: 'center_manager', description: 'Manages a single center — classes, staff, reports', color: '#085041', is_system: true },
  { name: 'teacher', description: 'Records attendance, progress, and assessments', color: '#0C447C', is_system: true },
  { name: 'student', description: 'Read-only access to own progress and results', color: '#633806', is_system: true },
];

// ─── Permission catalogue ─────────────────────────────────────────────────────
// key format: "{module}.{action}"

const PERMISSIONS = [
  // org
  { key: 'org.view', label: 'View Organisation', label_ur: 'تنظیم دیکھیں', module: 'org', action: 'view' },
  { key: 'org.edit', label: 'Edit Organisation', label_ur: 'تنظیم میں ترمیم کریں', module: 'org', action: 'edit' },

  // centers
  { key: 'centers.view', label: 'View Centers', label_ur: 'مراکز دیکھیں', module: 'centers', action: 'view' },
  { key: 'centers.create', label: 'Create Centers', label_ur: 'مرکز بنائیں', module: 'centers', action: 'create' },
  { key: 'centers.edit', label: 'Edit Centers', label_ur: 'مرکز میں ترمیم کریں', module: 'centers', action: 'edit' },
  { key: 'centers.delete', label: 'Delete Centers', label_ur: 'مرکز حذف کریں', module: 'centers', action: 'delete' },

  // courses
  { key: 'courses.view', label: 'View Courses', label_ur: 'کورسز دیکھیں', module: 'courses', action: 'view' },
  { key: 'courses.create', label: 'Create Courses', label_ur: 'کورس بنائیں', module: 'courses', action: 'create' },
  { key: 'courses.edit', label: 'Edit Courses', label_ur: 'کورس میں ترمیم کریں', module: 'courses', action: 'edit' },
  { key: 'courses.delete', label: 'Delete Courses', label_ur: 'کورس حذف کریں', module: 'courses', action: 'delete' },

  // topics
  { key: 'topics.view', label: 'View Topics', label_ur: 'موضوعات دیکھیں', module: 'topics', action: 'view' },
  { key: 'topics.create', label: 'Create Topics', label_ur: 'موضوع بنائیں', module: 'topics', action: 'create' },
  { key: 'topics.edit', label: 'Edit Topics', label_ur: 'موضوع میں ترمیم کریں', module: 'topics', action: 'edit' },
  { key: 'topics.delete', label: 'Delete Topics', label_ur: 'موضوع حذف کریں', module: 'topics', action: 'delete' },

  // classes
  { key: 'classes.view', label: 'View Classes', label_ur: 'کلاسز دیکھیں', module: 'classes', action: 'view' },
  { key: 'classes.create', label: 'Create Classes', label_ur: 'کلاس بنائیں', module: 'classes', action: 'create' },
  { key: 'classes.edit', label: 'Edit Classes', label_ur: 'کلاس میں ترمیم کریں', module: 'classes', action: 'edit' },
  { key: 'classes.delete', label: 'Delete Classes', label_ur: 'کلاس حذف کریں', module: 'classes', action: 'delete' },

  // homework_criteria
  { key: 'homework_criteria.view', label: 'View Homework Criteria', label_ur: 'گھر کا کام معیار دیکھیں', module: 'homework_criteria', action: 'view' },
  { key: 'homework_criteria.create', label: 'Create Homework Criteria', label_ur: 'گھر کا کام معیار بنائیں', module: 'homework_criteria', action: 'create' },
  { key: 'homework_criteria.edit', label: 'Edit Homework Criteria', label_ur: 'گھر کا کام معیار میں ترمیم کریں', module: 'homework_criteria', action: 'edit' },
  { key: 'homework_criteria.deactivate', label: 'Deactivate Homework Criteria', label_ur: 'گھر کا کام معیار غیر فعال کریں', module: 'homework_criteria', action: 'deactivate' },

  // enrollments
  { key: 'enrollments.view', label: 'View Enrollments', label_ur: 'داخلے دیکھیں', module: 'enrollments', action: 'view' },
  { key: 'enrollments.create', label: 'Create Enrollments', label_ur: 'داخلہ کریں', module: 'enrollments', action: 'create' },
  { key: 'enrollments.withdraw', label: 'Withdraw Enrollments', label_ur: 'داخلہ واپس لیں', module: 'enrollments', action: 'withdraw' },
  { key: 'enrollments.transfer', label: 'Transfer Enrollments', label_ur: 'داخلہ منتقل کریں', module: 'enrollments', action: 'transfer' },

  // attendance
  { key: 'attendance.view', label: 'View Attendance', label_ur: 'حاضری دیکھیں', module: 'attendance', action: 'view' },
  { key: 'attendance.mark', label: 'Mark Attendance', label_ur: 'حاضری لگائیں', module: 'attendance', action: 'mark' },
  { key: 'attendance.correct', label: 'Correct Attendance', label_ur: 'حاضری درست کریں', module: 'attendance', action: 'correct' },
  { key: 'attendance.export', label: 'Export Attendance', label_ur: 'حاضری برآمد کریں', module: 'attendance', action: 'export' },

  // progress
  { key: 'progress.view', label: 'View Progress', label_ur: 'ترقی دیکھیں', module: 'progress', action: 'view' },
  { key: 'progress.create', label: 'Log Progress', label_ur: 'ترقی درج کریں', module: 'progress', action: 'create' },
  { key: 'progress.edit', label: 'Edit Progress', label_ur: 'ترقی میں ترمیم کریں', module: 'progress', action: 'edit' },

  // homework
  { key: 'homework.view', label: 'View Homework', label_ur: 'گھر کا کام دیکھیں', module: 'homework', action: 'view' },
  { key: 'homework.score', label: 'Score Homework', label_ur: 'گھر کے کام کا نمبر دیں', module: 'homework', action: 'score' },
  { key: 'homework.correct', label: 'Correct Homework', label_ur: 'گھر کا کام درست کریں', module: 'homework', action: 'correct' },

  // assessments
  { key: 'assessments.view', label: 'View Assessments', label_ur: 'امتحانات دیکھیں', module: 'assessments', action: 'view' },
  { key: 'assessments.create', label: 'Create Assessments', label_ur: 'امتحان بنائیں', module: 'assessments', action: 'create' },
  { key: 'assessments.edit', label: 'Edit Assessments', label_ur: 'امتحان میں ترمیم کریں', module: 'assessments', action: 'edit' },
  { key: 'assessments.record_results', label: 'Record Assessment Results', label_ur: 'امتحانی نتائج درج کریں', module: 'assessments', action: 'record_results' },

  // reports
  { key: 'reports.view_org', label: 'View Org Report', label_ur: 'تنظیمی رپورٹ دیکھیں', module: 'reports', action: 'view_org' },
  { key: 'reports.view_center', label: 'View Center Report', label_ur: 'مرکزی رپورٹ دیکھیں', module: 'reports', action: 'view_center' },
  { key: 'reports.view_student', label: 'View Student Report', label_ur: 'طالب علم رپورٹ دیکھیں', module: 'reports', action: 'view_student' },
  { key: 'reports.export', label: 'Export Reports', label_ur: 'رپورٹ برآمد کریں', module: 'reports', action: 'export' },

  // users
  { key: 'users.view', label: 'View Users', label_ur: 'صارفین دیکھیں', module: 'users', action: 'view' },
  { key: 'users.create', label: 'Create Users', label_ur: 'صارف بنائیں', module: 'users', action: 'create' },
  { key: 'users.edit', label: 'Edit Users', label_ur: 'صارف میں ترمیم کریں', module: 'users', action: 'edit' },
  { key: 'users.deactivate', label: 'Deactivate Users', label_ur: 'صارف غیر فعال کریں', module: 'users', action: 'deactivate' },

  // roles
  { key: 'roles.view', label: 'View Roles', label_ur: 'کردار دیکھیں', module: 'roles', action: 'view' },
  { key: 'roles.create', label: 'Create Roles', label_ur: 'کردار بنائیں', module: 'roles', action: 'create' },
  { key: 'roles.edit', label: 'Edit Roles', label_ur: 'کردار میں ترمیم کریں', module: 'roles', action: 'edit' },
  { key: 'roles.delete', label: 'Delete Roles', label_ur: 'کردار حذف کریں', module: 'roles', action: 'delete' },
  { key: 'roles.assign', label: 'Assign Roles', label_ur: 'کردار تفویض کریں', module: 'roles', action: 'assign' },

  // permissions
  { key: 'permissions.view', label: 'View Permissions', label_ur: 'اجازتیں دیکھیں', module: 'permissions', action: 'view' },
  { key: 'permissions.assign', label: 'Assign Permissions', label_ur: 'اجازت تفویض کریں', module: 'permissions', action: 'assign' },

  // activity
  { key: 'activity.view', label: 'View Activity Log', label_ur: 'سرگرمی لاگ دیکھیں', module: 'activity', action: 'view' },

  // salaries
  { key: 'salaries.view', label: 'View Salaries', label_ur: 'تنخواہیں دیکھیں', module: 'salaries', action: 'view' },
  { key: 'salaries.edit', label: 'Edit Salaries', label_ur: 'تنخواہوں میں ترمیم کریں', module: 'salaries', action: 'edit' },
  { key: 'salaries.pay', label: 'Pay Salaries', label_ur: 'تنخواہ ادا کریں', module: 'salaries', action: 'pay' },

  // donations
  { key: 'donations.view', label: 'View Donations', label_ur: 'عطیات دیکھیں', module: 'donations', action: 'view' },
  { key: 'donations.create', label: 'Record Donations', label_ur: 'عطیات درج کریں', module: 'donations', action: 'create' },
];

// ─── Role → permission assignments ───────────────────────────────────────────

const ALL_KEYS = PERMISSIONS.map((p) => p.key);

const ROLE_PERMISSION_KEYS = {
  super_admin: ALL_KEYS,

  finance_manager: [
    'salaries.view', 'salaries.pay',
    'donations.view', 'donations.create',
    'users.view',
    'reports.view_org', 'reports.view_center', 'reports.export',
    'activity.view'
  ],

  center_manager: [
    'centers.view', 'centers.edit',
    'courses.view',
    'topics.view',
    'classes.view', 'classes.create', 'classes.edit',
    'homework_criteria.view', 'homework_criteria.create', 'homework_criteria.edit', 'homework_criteria.deactivate',
    'enrollments.view', 'enrollments.create', 'enrollments.withdraw', 'enrollments.transfer',
    'attendance.view', 'attendance.mark', 'attendance.correct', 'attendance.export',
    'progress.view',
    'homework.view',
    'assessments.view', 'assessments.create', 'assessments.edit', 'assessments.record_results',
    'reports.view_center', 'reports.view_student', 'reports.export',
    'users.view', 'users.create', 'users.edit',
    'activity.view',
    'salaries.view', 'salaries.edit', 'salaries.pay',
    'donations.view', 'donations.create'
  ],

  teacher: [
    'classes.view',
    'homework_criteria.view',
    'enrollments.view',
    'attendance.mark', 'attendance.correct',
    'progress.view', 'progress.create', 'progress.edit',
    'homework.view', 'homework.score', 'homework.correct',
    'assessments.view', 'assessments.create', 'assessments.record_results',
    'reports.view_student',
    'users.view',
  ],

  student: [
    'attendance.view',
    'progress.view',
    'homework.view',
    'assessments.view',
    'reports.view_student',
  ],
};

// ─── Seed function ────────────────────────────────────────────────────────────

exports.seed = async (knex) => {
  // 1. Upsert system roles — insert if missing, then mark is_system = true
  for (const role of SYSTEM_ROLES) {
    const existing = await knex('roles').where({ name: role.name }).first();
    if (existing) {
      await knex('roles').where({ name: role.name }).update({
        is_system: true,
        color: role.color,
        description: role.description,
      });
    } else {
      await knex('roles')
        .insert({ ...role })
        .onConflict('name')
        .ignore();
    }
  }

  // 2. Insert permissions — skip if the key already exists
  await knex('permissions')
    .insert(PERMISSIONS.map((p) => ({ ...p })))
    .onConflict('key')
    .ignore();

  // 3. Load role and permission IDs for FK references
  const roles = await knex('roles')
    .whereIn('name', Object.keys(ROLE_PERMISSION_KEYS))
    .select('id', 'name');

  const perms = await knex('permissions')
    .select('id', 'key');

  const roleById = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const permById = Object.fromEntries(perms.map((p) => [p.key, p.id]));

  // 4. Build role_permissions rows and insert, ignoring duplicates
  const rows = [];
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSION_KEYS)) {
    const roleId = roleById[roleName];
    if (!roleId) continue;

    for (const key of keys) {
      const permId = permById[key];
      if (!permId) continue;
      rows.push({ role_id: roleId, permission_id: permId });
    }
  }

  if (rows.length > 0) {
    await knex('role_permissions')
      .insert(rows)
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};
