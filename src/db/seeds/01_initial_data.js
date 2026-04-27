const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // 1. Clear existing data (reverse order of foreign keys)
  await knex('homework_criteria').del();
  await knex('class_teachers').del();
  await knex('classes').del();
  await knex('topic_subtopics').del();
  await knex('topics').del();
  await knex('course_levels').del();
  await knex('courses').del();
  await knex('guardians').del();
  await knex('user_roles').del();
  await knex('users').del();
  await knex('roles').del();
  await knex('classrooms').del();
  await knex('centers').del();
  await knex('organizations').del();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Create Organization
  const [org] = await knex('organizations').insert({
    name: 'Quran Foundation',
    name_ur: 'قرآن فاؤنڈیشن',
    contact_email: 'info@quranfoundation.com',
    contact_phone: '+923001234567'
  }).returning('*');

  // 3. Create Centers
  const [center1] = await knex('centers').insert({
    org_id: org.id,
    name: 'Main Campus',
    name_ur: 'مرکزی کیمپس',
    city: 'Lahore',
    address: 'Block A, Model Town'
  }).returning('*');

  const [center2] = await knex('centers').insert({
    org_id: org.id,
    name: 'North Branch',
    name_ur: 'شمالی شاخ',
    city: 'Lahore',
    address: 'Johar Town'
  }).returning('*');

  // 4. Create Roles
  const roles = await knex('roles').insert([
    { name: 'super_admin',    description: 'Full system access' },
    { name: 'center_manager', description: 'Manage a specific center' },
    { name: 'teacher',        description: 'Manage classes and students' },
    { name: 'student',        description: 'Learning user' },
    { name: 'guardian',       description: 'Parent/Guardian of students' }
  ]).returning('*');

  const roleMap = roles.reduce((acc, r) => ({ ...acc, [r.name]: r.id }), {});

  // 5. Create Users
  // Super Admin
  const [admin] = await knex('users').insert({
    email: 'admin@qf.com',
    phone: '+923001112233',
    password_hash: passwordHash,
    full_name: 'Super Admin',
    preferred_lang: 'en'
  }).returning('*');

  // Center Manager
  const [manager] = await knex('users').insert({
    email: 'manager@qf.com',
    phone: '+923002223344',
    password_hash: passwordHash,
    full_name: 'Center Manager',
    preferred_lang: 'ur'
  }).returning('*');

  // Teachers
  const [teacher1, teacher2] = await knex('users').insert([
    {
      email: 'teacher1@qf.com',
      phone: '+923004445566',
      password_hash: passwordHash,
      full_name: 'Zaid bin Sabit',
      full_name_ur: 'زید بن ثابت',
      gender: 'male',
      preferred_lang: 'ar'
    },
    {
      email: 'teacher2@qf.com',
      phone: '+923005556677',
      password_hash: passwordHash,
      full_name: 'Fatima Zahra',
      full_name_ur: 'فاطمہ زہرا',
      gender: 'female',
      preferred_lang: 'ur'
    }
  ]).returning('*');

  // Students
  const [student1, student2, student3] = await knex('users').insert([
    {
      email: 'student1@qf.com',
      phone: '+923007778899',
      password_hash: passwordHash,
      full_name: 'Abdullah Khan',
      gender: 'male',
      date_of_birth: '2015-05-15'
    },
    {
      email: 'student2@qf.com',
      phone: '+923008889900',
      password_hash: passwordHash,
      full_name: 'Zainab Ahmed',
      gender: 'female',
      date_of_birth: '2016-08-20'
    },
    {
      email: 'student3@qf.com',
      phone: '+923009990011',
      password_hash: passwordHash,
      full_name: 'Umar Farooq',
      gender: 'male',
      date_of_birth: '2014-02-10'
    }
  ]).returning('*');

  // 6. Create Academic Data
  const [course] = await knex('courses').insert({
    org_id: org.id,
    name: 'Nazra Quran',
    name_ur: 'ناظرہ قرآن',
    type: 'nazra',
    description_ur: 'قرآن کریم کو دیکھ کر پڑھنے کا کورس'
  }).returning('*');

  const [level1] = await knex('course_levels').insert({
    course_id: course.id,
    title: 'Level 1: Basic Reading',
    title_ur: 'لیول 1: بنیادی قاعدہ',
    level_order: 1
  }).returning('*');

  const [topic] = await knex('topics').insert({
    course_id: course.id,
    created_by: admin.id,
    title: 'Surah Al-Fatiha',
    title_ur: 'سورۃ الفاتحہ',
    title_ar: 'سورة الفاتحة',
    display_order: 1
  }).returning('*');

  // 7. Create Classes
  const [cls] = await knex('classes').insert({
    center_id: center1.id,
    course_id: course.id,
    course_level_id: level1.id,
    name: 'Morning Batch A',
    name_ur: 'صبح کا بیچ الف',
    max_capacity: 20,
    schedule_days: 'monday,tuesday,wednesday,thursday,friday',
    start_time: '08:00:00'
  }).returning('*');

  // Assign Teacher to Class
  await knex('class_teachers').insert({
    class_id: cls.id,
    teacher_user_id: teacher1.id,
    is_primary: true,
    assigned_from: knex.fn.now()
  });

  // Add Homework Criteria
  await knex('homework_criteria').insert([
    { class_id: cls.id, label: 'Fluency', label_ur: 'روانی', max_marks: 10, display_order: 1 },
    { class_id: cls.id, label: 'Pronunciation', label_ur: 'تلفظ', max_marks: 10, display_order: 2 }
  ]);

  // 8. Assign Roles
  await knex('user_roles').insert([
    // Admin is global (no center_id)
    { user_id: admin.id,    role_id: roleMap['super_admin'],    center_id: null },
    
    // Manager for Center 1
    { user_id: manager.id,  role_id: roleMap['center_manager'], center_id: center1.id },
    
    // Teachers for Center 1
    { user_id: teacher1.id, role_id: roleMap['teacher'],        center_id: center1.id },
    { user_id: teacher2.id, role_id: roleMap['teacher'],        center_id: center1.id },
    
    // Students for Center 1
    { user_id: student1.id, role_id: roleMap['student'],        center_id: center1.id },
    { user_id: student2.id, role_id: roleMap['student'],        center_id: center1.id },
    { user_id: student3.id, role_id: roleMap['student'],        center_id: center1.id }
  ]);

  console.log('Seed data inserted successfully!');
};
