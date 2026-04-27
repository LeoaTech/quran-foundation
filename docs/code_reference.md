# Quran Foundation LMS — Code Reference

Complete technical reference for all implemented modules. Use this alongside `api_reference.html` and `database_schema.html`.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Entry Points](#entry-points)
3. [Database & Migrations](#database--migrations)
4. [Utilities](#utilities)
5. [Middleware](#middleware)
6. [Auth Module](#auth-module)
7. [Centers Module](#centers-module)
8. [Users & Roles Module](#users--roles-module)
9. [Courses & Topics Module](#courses--topics-module)
10. [Classes Module](#classes-module)
11. [Enrollments Module](#enrollments-module)
12. [Attendance Module](#attendance-module)
13. [Progress Sessions Module](#progress-sessions-module)
14. [Jobs & Workers](#jobs--workers)
15. [Error Codes Reference](#error-codes-reference)
16. [RBAC Summary](#rbac-summary)

---

## Project Structure

```
src/
  app.js                        Express app setup, middleware, route mounting
  server.js                     HTTP server entry point

  db/
    knex.js                     Knex singleton (env-aware)
    migrations/
      001_extensions.js         uuid-ossp extension
      002_organizations_centers.js  organizations, centers, classrooms
      003_users_roles.js        roles, users, user_roles, guardians
      004_courses_topics.js     courses, topics, subtopics
      005_classes.js            classes, class_teachers, homework_criteria
      006_enrollments_attendance.js enrollments, attendance_records
      007_progress.js           progress_sessions, homework_entries, homework_scores
      008_assessments.js        assessments

  utils/
    errors.js                   AppError class
    redis.js                    Lazy Redis client singleton

  middleware/
    auth.js                     JWT Bearer token verification → req.user
    rbac.js                     requireRoles(...roles) factory
    validate.js                 Zod schema validation → req.body

  repositories/                 All Knex DB queries — no SQL elsewhere
    auth.repository.js
    centers.repository.js
    users.repository.js
    courses.repository.js
    classes.repository.js
    enrollments.repository.js
    attendance.repository.js
    progress.repository.js

  services/                     Business logic
    auth.service.js
    centers.service.js
    users.service.js
    courses.service.js
    classes.service.js
    enrollments.service.js
    attendance.service.js
    progress.service.js

  controllers/                  Thin req/res wrappers — parse req, call service, send res
    auth.controller.js
    centers.controller.js
    users.controller.js
    courses.controller.js
    classes.controller.js
    enrollments.controller.js
    attendance.controller.js
    progress.controller.js

  routes/                       Express routers with Zod schemas and RBAC
    auth.js                     → mounted at /api/v1/auth
    centers.js                  → mounted at /api/v1
    users.js                    → mounted at /api/v1
    courses.js                  → mounted at /api/v1
    classes.js                  → mounted at /api/v1
    enrollments.js              → mounted at /api/v1
    attendance.js               → mounted at /api/v1
    progress.js                 → mounted at /api/v1/progress-sessions

  jobs/
    notifyGuardian.js           Bull queue definition

  workers/
    whatsappWorker.js           Bull worker stub
```

---

## Entry Points

### `src/server.js`

Starts the HTTP server. Verifies DB connection with `SELECT 1` before listening.

```js
const PORT = parseInt(process.env.PORT || '3000', 10);
await db.raw('SELECT 1'); // fails fast on bad DB config
app.listen(PORT, callback);
```

### `src/app.js`

Express app configuration. Route mount order:

```
/api/v1/auth              → routes/auth.js
/api/v1                   → routes/centers.js
/api/v1                   → routes/users.js
/api/v1                   → routes/courses.js
/api/v1                   → routes/classes.js
/api/v1/progress-sessions → routes/progress.js
```

Also mounted: `app.use('/api/v1', require('./routes/enrollments'))` and `app.use('/api/v1', require('./routes/attendance'))`

Middleware stack (in order): `helmet` → `cors` → `rateLimit` → `express.json` → `express.urlencoded` → `express.static(public/)`

---

## Database & Migrations

### `src/db/knex.js`

Singleton Knex instance. Reads `NODE_ENV` to select the correct `knexfile.js` config block.

```js
module.exports = knex(config[process.env.NODE_ENV || 'development']);
```

### Migration 001 — Extensions

Enables `uuid-ossp` so `uuid_generate_v4()` is available as a column default.

### Migration 002 — Organizations, Centers, Classrooms

| Table | Key columns |
|-------|-------------|
| `organizations` | `id`, `name`, `name_ur`, `name_ar`, `logo_url`, `contact_email`, `contact_phone`, `is_active` |
| `centers` | `id`, `org_id` FK, `name`, `name_ur`, `address`, `address_ur`, `city`, `phone`, `is_active` |
| `classrooms` | `id`, `center_id` FK, `name`, `name_ur`, `capacity`, `session_name`, `session_date`, `is_active` |

### Migration 003 — Users, Roles, Guardians

| Table | Key columns |
|-------|-------------|
| `roles` | `id`, `name` (unique), `description`, `is_active` |
| `users` | `id`, `email` (unique), `password_hash`, `full_name`, `full_name_ur`, `display_name_ar`, `phone`, `whatsapp`, `date_of_birth`, `gender`, `preferred_lang`, `last_login_at`, `is_active` |
| `user_roles` | `id`, `user_id` FK, `role_id` FK, `center_id` FK (nullable for super_admin), `assigned_at`; unique on `(user_id, role_id, center_id)` |
| `guardians` | `id`, `student_user_id` FK, `guardian_user_id` FK, `relation`, `is_primary`; unique on `(student_user_id, guardian_user_id)` |

**Important:** `users` has no `center_id` column. Center scope flows exclusively through `user_roles.center_id`.

---

## Utilities

### `src/utils/errors.js` — `AppError`

```js
new AppError(code, message, message_ur, status = 400, field = null)
```

| Param | Type | Purpose |
|-------|------|---------|
| `code` | string | SNAKE_CASE error code (e.g. `NOT_FOUND`) |
| `message` | string | English description |
| `message_ur` | string | Urdu description (always required) |
| `status` | number | HTTP status code |
| `field` | string \| null | Field name for validation errors only |

All thrown `AppError` instances are caught by the global error handler in `app.js` and serialized to the standard error shape defined in `CLAUDE.md`.

### `src/utils/redis.js` — `getRedis()`

Lazy singleton Redis client. Deduplicates concurrent `connect()` calls using a shared promise.

```js
const { getRedis } = require('../utils/redis');
const redis = await getRedis(); // safe to call multiple times
```

---

## Middleware

### `src/middleware/auth.js` — `requireAuth`

Extracts `Authorization: Bearer <token>`, verifies with `JWT_ACCESS_SECRET`, checks `payload.type === 'access'`.

Sets `req.user`:
```js
req.user = {
  id:        payload.sub,       // user UUID
  roles:     payload.roles,     // string[]
  center_id: payload.center_id, // UUID | null (null for super_admin)
}
```

Error codes thrown: `UNAUTHORIZED` (missing token, 401), `TOKEN_EXPIRED` (401), `INVALID_TOKEN` (401).

### `src/middleware/rbac.js` — `requireRoles(...roles)`

Factory middleware. `super_admin` always passes regardless of listed roles.

```js
requireRoles('teacher', 'center_manager')
// super_admin → next()
// teacher at any center → next()
// student → 403 FORBIDDEN
```

### `src/middleware/validate.js` — `validate(schema)`

Wraps a Zod schema. On failure, throws `AppError` with `VALIDATION_ERROR`, HTTP 400, and `field` set to the first failing path joined by `.`. On success, replaces `req.body` with the parsed (coerced) output.

---

## Auth Module

**Route prefix:** `/api/v1/auth`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Authenticate, receive tokens |
| POST | `/refresh` | Public | Exchange refresh token for new access token |
| POST | `/logout` | `requireAuth` | Revoke refresh token |
| POST | `/change-password` | `requireAuth` | Change own password |

### Request / Response shapes

**POST /login**
```json
// Request
{ "phone": "+923001234567", "password": "secret", "center_id": "uuid (optional)" }

// Response 200
{
  "access_token": "...",
  "refresh_token": "...",
  "user": { "id", "full_name", "full_name_ur", "preferred_lang", "roles", "center_id" }
}
```

**POST /refresh**
```json
// Request
{ "refresh_token": "..." }

// Response 200
{ "access_token": "..." }
```

**POST /change-password**
```json
// Request
{ "current_password": "...", "new_password": "min 8 chars" }
// Response 204
```

### `src/repositories/auth.repository.js`

| Function | Description |
|----------|-------------|
| `findByPhone(phone)` | Find active user by phone |
| `findById(id)` | Find active user by UUID |
| `getUserRoles(userId)` | Returns `{ role, center_id }[]` — all active role rows across all centers |
| `updateLastLogin(userId)` | Stamps `last_login_at` |
| `updatePassword(userId, hash)` | Updates `password_hash` |

### `src/services/auth.service.js`

**`resolveScope(allRoles, requestedCenterId)`** — key helper:
- If user has `super_admin` role (where `center_id IS NULL`) → returns `{ roles: ['super_admin'], scopedCenterId: requestedCenterId || null }`
- Otherwise → filters roles to the requested (or first available) center; throws `403 FORBIDDEN` if no match

**Token strategy:**
- Access token: `{ sub, type: 'access', roles, center_id }` — 15 min default
- Refresh token: `{ sub, type: 'refresh', jti: uuidv4(), center_id }` — 30 days default
- Revocation: on logout, JTI stored in Redis with `EX = remaining TTL seconds` under key `revoked:jti:<jti>`
- Refresh validates JTI is not revoked, then reloads roles from DB so permission changes take effect immediately

---

## Centers Module

**Route prefix:** `/api/v1`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/org` | super_admin | Get organization details |
| GET | `/centers` | super_admin | List centers (paginated, filterable) |
| POST | `/centers` | super_admin | Create a center |
| GET | `/centers/:center_id` | super_admin, center_manager | Get a center |
| PATCH | `/centers/:center_id` | super_admin, center_manager | Update a center |
| GET | `/centers/:center_id/classrooms` | super_admin, center_manager, teacher | List classrooms |
| POST | `/centers/:center_id/classrooms` | super_admin, center_manager | Create a classroom |

### Query params — GET /centers

```
?city=Karachi&is_active=true&page=1&per_page=20
```

### Request bodies

**POST /centers**
```json
{
  "name": "Main Center",
  "name_ur": "مرکزی مرکز",
  "city": "Karachi",
  "phone": "+92300...",
  "address": "...",
  "address_ur": "..."
}
```
`org_id` is auto-injected by the service (fetches the single active org from DB).

**POST /centers/:center_id/classrooms**
```json
{
  "name": "Room A",
  "name_ur": "کمرہ الف",
  "capacity": 25,
  "session_name": "Morning",
  "session_date": "2025-09-01"
}
```

**PATCH /centers/:center_id** — any subset of center fields + optional `is_active` boolean. At least one field required.

### `src/repositories/centers.repository.js`

| Function | Description |
|----------|-------------|
| `getOrg()` | First active organization row |
| `listCenters(filters)` | Paginated, filterable by `city`, `isActive` |
| `countCenters(filters)` | Total count for pagination meta |
| `getCenterById(centerId)` | Single center row |
| `createCenter(data)` | Insert + `RETURNING *` |
| `updateCenter(centerId, data)` | Patch + `updated_at` + `RETURNING *` |
| `listClassrooms(centerId, filters)` | Filterable by `isActive` |
| `createClassroom(data)` | Insert + `RETURNING *` |

### `src/services/centers.service.js`

**`assertCenterAccess(user, centerId)`** — throws `403 FORBIDDEN` if a non-super_admin user's `center_id` does not match the target `centerId`.

`listCenters` returns:
```json
{
  "data": [...],
  "meta": { "page", "per_page", "total", "total_pages" }
}
```

---

## Users & Roles Module

**Route prefix:** `/api/v1`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/users` | super_admin, center_manager | List users (scoped) |
| POST | `/users` | super_admin, center_manager | Create user + initial role |
| GET | `/users/:user_id` | Any authenticated | Get user profile with roles |
| PATCH | `/users/:user_id` | Any authenticated (service enforces scope) | Update profile |
| POST | `/users/:user_id/roles` | super_admin, center_manager | Assign additional role |
| DELETE | `/users/:user_id/roles/:role_id` | super_admin | Remove a role assignment |
| POST | `/users/:user_id/guardians` | super_admin, center_manager | Link guardian to student |
| GET | `/users/:user_id/guardians` | super_admin, center_manager | List student's guardians |

### Query params — GET /users

```
?center_id=uuid&role=teacher&is_active=true&search=Tariq&page=1&per_page=20
```

`search` queries both `full_name` (English) and `full_name_ur` (Urdu) — case-insensitive via `whereILike`.

center_manager is hard-scoped to their own `center_id`; the `center_id` query param is ignored for non-super_admin callers.

### Request bodies

**POST /users**
```json
{
  "full_name": "Hamza Rauf",
  "full_name_ur": "حمزہ رؤف",
  "phone": "+923001234567",
  "whatsapp": "+923001234567",
  "date_of_birth": "2012-03-15",
  "gender": "male",
  "preferred_lang": "ur",
  "role": "student",
  "center_id": "uuid"
}
```

**Response 201:**
```json
{ "id": "uuid", "full_name": "Hamza Rauf", "temp_password": "Qf3a9f12e4" }
```
`temp_password` is returned **once only** — it is not stored anywhere. The hashed version is stored in `users.password_hash`.

**POST /users/:user_id/roles**
```json
{ "role": "teacher", "center_id": "uuid" }
```

**POST /users/:user_id/guardians**
```json
{ "guardian_user_id": "uuid", "relation": "father", "is_primary": true }
```

### `src/repositories/users.repository.js`

| Function | Description |
|----------|-------------|
| `listUsers(filters)` | Join users → user_roles → roles; bilingual search; paginated |
| `countUsers(filters)` | `COUNT DISTINCT u.id` with same filters |
| `getUserById(userId)` | Raw user row (no roles) |
| `getUserWithRoles(userId)` | User row + `roles[]` sub-query |
| `createUser({ userData, roleData }, trx)` | Insert user + look up role by name + insert user_roles in one transaction |
| `updateUser(userId, data)` | Patch + `updated_at` + `RETURNING *` |
| `getRoleByName(name)` | Lookup role row by name string |
| `getUserRoleEntry(userId, roleId, centerId)` | Check for duplicate assignment |
| `assignRole({ userId, roleId, centerId })` | Insert user_roles row |
| `removeRole(userRoleId)` | Hard delete user_roles row by primary key |
| `linkGuardian(data)` | Insert guardians row |
| `listGuardians(studentUserId)` | Join guardians → users, return guardian profile |
| `getGuardianLink(studentUserId, guardianUserId)` | Duplicate check |

### `src/services/users.service.js`

**Temp password generation:** `Qf` + 8 random hex chars (10 chars total), bcrypt-hashed with salt rounds 10.

**`assertCenterScope(user, targetCenterId)`** — throws `403 FORBIDDEN` if `center_manager`'s `center_id` doesn't match the target center. super_admin always passes.

**`updateUser` scope rules:**
- Own profile (caller.id === userId) → always allowed
- Otherwise: non-super_admin must share a `center_id` with the target user via `user_roles`

**`removeRole`** — super_admin only. Takes `user_roles.id` (the join row PK) as `:role_id` in the URL — this is a hard delete of the assignment row, not the user.

---

## Courses & Topics Module

**Route prefix:** `/api/v1`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/courses` | Any authenticated | List all courses |
| POST | `/courses` | super_admin | Create a course |
| GET | `/courses/:course_id` | Any authenticated | Get a course |
| PATCH | `/courses/:course_id` | super_admin | Update a course |
| POST | `/courses/:course_id/levels` | super_admin | Add a course level |
| GET | `/courses/:course_id/topics` | Any authenticated | List topics with nested subtopics |
| POST | `/courses/:course_id/topics` | teacher, center_manager | Create a topic |
| PATCH | `/courses/:course_id/topics/:topic_id` | teacher, center_manager | Update a topic |
| DELETE | `/courses/:course_id/topics/:topic_id` | teacher, center_manager | Soft-delete a topic |
| POST | `/courses/:course_id/topics/:topic_id/subtopics` | teacher, center_manager | Add a subtopic |
| PATCH | `/courses/:course_id/topics/:topic_id/subtopics/:subtopic_id` | teacher, center_manager | Update a subtopic |
| DELETE | `/courses/:course_id/topics/:topic_id/subtopics/:subtopic_id` | teacher, center_manager | Soft-delete a subtopic |

### Request bodies

**POST /courses**
```json
{
  "name": "Tajweed",
  "name_ur": "تجوید",
  "name_ar": "تجويد",
  "type": "tajweed",
  "description_ur": "قرآن کریم کی تلاوت کے اصول"
}
```
Valid `type` values: `hifz`, `nazra`, `tajweed`, `arabic`. `org_id` is auto-injected from the single active org.

**POST /courses/:course_id/levels**
```json
{ "title": "Beginner", "title_ur": "ابتدائی", "description_ur": "...", "level_order": 1 }
```

**POST /courses/:course_id/topics**
```json
{
  "title": "Makharij al-Huruf",
  "title_ur": "مخارج الحروف",
  "title_ar": "مخارج الحروف",
  "description_ur": "حروف کے مخارج کا بیان",
  "display_order": 1
}
```
`created_by` is auto-injected from `req.user.id`.

**POST /courses/:course_id/topics/:topic_id/subtopics**
```json
{ "title": "Huruf Halqi", "title_ur": "حروف حلقی", "title_ar": "الحروف الحلقية", "display_order": 1 }
```

### GET /courses/:course_id/topics — response shape

Returns topics sorted by `display_order ASC`, each with a `subtopics` array sorted by `display_order ASC`:

```json
[
  {
    "id": "uuid",
    "title": "Makharij al-Huruf",
    "title_ur": "مخارج الحروف",
    "title_ar": "مخارج الحروف",
    "description_ur": "...",
    "display_order": 1,
    "created_by": "uuid",
    "created_at": "...",
    "subtopics": [
      { "id": "uuid", "title": "Huruf Halqi", "title_ur": "حروف حلقی", "title_ar": "...", "display_order": 1 },
      { "id": "uuid", "title": "Huruf Lisani", "title_ur": "حروف لسانی", "title_ar": "...", "display_order": 2 }
    ]
  }
]
```

Topics with no subtopics return `"subtopics": []`.

### `src/repositories/courses.repository.js`

| Function | Description |
|----------|-------------|
| `listCourses({ isActive })` | All courses, optionally filtered by `is_active` |
| `getCourseById(courseId)` | Single course row |
| `createCourse(data)` | Insert + `RETURNING *` |
| `updateCourse(courseId, data)` | Patch + `updated_at` + `RETURNING *` |
| `listLevelsByCourse(courseId)` | Active levels ordered by `level_order ASC` |
| `createLevel(data)` | Insert + `RETURNING *` |
| `getTopicsWithSubtopics(courseId)` | Single left-join query + JS grouping (see below) |
| `getTopicById(topicId)` | Single topic row |
| `createTopic(data)` | Insert + `RETURNING *` |
| `updateTopic(topicId, data)` | Patch + `updated_at` + `RETURNING *` |
| `deactivateTopic(topicId)` | Sets `is_active=false` — never deletes |
| `getSubtopicById(subtopicId)` | Single subtopic row |
| `createSubtopic(data)` | Insert + `RETURNING *` |
| `updateSubtopic(subtopicId, data)` | Patch + `updated_at` + `RETURNING *` |
| `deactivateSubtopic(subtopicId)` | Sets `is_active=false` — never deletes |

**`getTopicsWithSubtopics` implementation detail:**

Single Knex left join on `topic_subtopics.is_active = true`, ordered by `t.display_order ASC, s.display_order ASC`. Result rows are then grouped in JS using a `Map` keyed on `topic_id`:

```js
// One DB query
const rows = await db('topics as t')
  .leftJoin('topic_subtopics as s', fn => fn.on('s.topic_id', 't.id').andOnVal('s.is_active', true))
  .where('t.course_id', courseId).where('t.is_active', true)
  .select('t.id as topic_id', ..., 's.id as sub_id', ...)
  .orderBy('t.display_order', 'asc').orderBy('s.display_order', 'asc');

// Group in JS
const topicMap = new Map();
for (const row of rows) {
  if (!topicMap.has(row.topic_id)) topicMap.set(row.topic_id, { ...topicFields, subtopics: [] });
  if (row.sub_id) topicMap.get(row.topic_id).subtopics.push({ ...subtopicFields });
}
return Array.from(topicMap.values());
```

### `src/services/courses.service.js`

**`requireCourse(courseId)`** — fetches course, throws `404 NOT_FOUND` if missing. Used as a guard in every operation.

**`requireTopic(topicId, courseId)`** — fetches topic, verifies `topic.course_id === courseId`, throws `404` otherwise.

**`requireSubtopic(subtopicId, topicId)`** — fetches subtopic, verifies `subtopic.topic_id === topicId`, throws `404` otherwise.

`createCourse` auto-injects `org_id` from the active org (same pattern as centers module). `createTopic` auto-injects `created_by` from `req.user.id`.

Soft deletes (`DELETE` endpoints) call `deactivateTopic` / `deactivateSubtopic` which set `is_active=false` and return the updated row — they never issue a SQL `DELETE`.

---

## Classes Module

**Route prefix:** `/api/v1`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/centers/:center_id/classes` | super_admin, center_manager, teacher | List classes (teacher-scoped for teachers) |
| POST | `/centers/:center_id/classes` | super_admin, center_manager | Create a class |
| GET | `/classes/:class_id` | super_admin, center_manager, teacher | Get a class |
| PATCH | `/classes/:class_id` | super_admin, center_manager | Update a class |
| GET | `/classes/:class_id/teachers` | super_admin, center_manager, teacher | List assigned teachers |
| POST | `/classes/:class_id/teachers` | super_admin, center_manager | Assign a teacher |
| DELETE | `/classes/:class_id/teachers/:teacher_id` | super_admin, center_manager | Remove teacher assignment (soft) |
| GET | `/classes/:class_id/homework-criteria` | super_admin, center_manager, teacher | List criteria |
| POST | `/classes/:class_id/homework-criteria` | super_admin, center_manager, teacher | Add a criterion |
| PATCH | `/classes/:class_id/homework-criteria/:criteria_id` | super_admin, center_manager, teacher | Update a criterion |
| DELETE | `/classes/:class_id/homework-criteria/:criteria_id` | super_admin, center_manager, teacher | Soft-delete criterion |

### Request bodies

**POST /centers/:center_id/classes**
```json
{
  "name": "Tajweed Class B",
  "name_ur": "تجوید کلاس ب",
  "course_id": "uuid",
  "course_level_id": "uuid (optional)",
  "max_capacity": 18,
  "schedule_days": "Mon,Wed,Fri",
  "start_time": "10:00"
}
```

**POST /classes/:class_id/teachers**
```json
{ "teacher_user_id": "uuid", "is_primary": true, "assigned_from": "2026-04-01" }
```
`:teacher_id` in the DELETE URL is `class_teachers.id` (the assignment row PK), not the user UUID.

**POST /classes/:class_id/homework-criteria**
```json
{
  "label": "Recitation accuracy",
  "label_ur": "تلاوت کی درستی",
  "topic_id": "uuid (optional)",
  "subtopic_id": "uuid (optional)",
  "max_marks": 10,
  "display_order": 1
}
```

### GET /classes/:class_id/homework-criteria — response shape

```json
[
  {
    "id": "uuid",
    "label": "Recitation accuracy",
    "label_ur": "تلاوت کی درستی",
    "topic_id": "uuid",
    "topic_title_ur": "مخارج الحروف",
    "subtopic_id": null,
    "max_marks": 10,
    "display_order": 1,
    "is_active": true
  }
]
```
`topic_title_ur` comes from a left-join with `topics` in the repository.

### `src/repositories/classes.repository.js`

| Function | Description |
|----------|-------------|
| `listClasses(centerId, filters)` | All classes in a center; filterable by `course_id`, `is_active` |
| `listClassesForTeacher(centerId, teacherUserId, filters)` | Inner-join with `class_teachers` — only returns the teacher's own classes |
| `getClassById(classId)` | Single class row |
| `createClass(data)` | Insert + `RETURNING *` |
| `updateClass(classId, data)` | Patch + `updated_at` + `RETURNING *` |
| `listTeachers(classId)` | Active teachers joined with users; ordered primary first |
| `getClassTeacherEntry(classId, teacherUserId)` | Ownership check — is this user an active teacher of this class? |
| `getClassTeacherById(classTeacherId)` | Single `class_teachers` row by PK |
| `assignTeacher(data)` | Insert + `RETURNING *` |
| `deactivateTeacher(classTeacherId)` | Sets `is_active=false`; never deletes |
| `listCriteria(classId, opts)` | Active criteria (or all if `includeInactive: true`); left-joined with `topics` for `topic_title_ur` |
| `getCriteriaById(criteriaId)` | Single `homework_criteria` row |
| `createCriteria(data)` | Insert + `RETURNING *` |
| `updateCriteria(criteriaId, data)` | Patch + `updated_at` + `RETURNING *` |
| `deactivateCriteria(criteriaId)` | Sets `is_active=false` — **never deletes** |

### `src/services/classes.service.js`

**`assertCenterAccess(user, centerId)`** — 403 if non-super_admin's `center_id` doesn't match.

**`assertClassAccess(user, cls)`** — two-tier check:
- `center_manager` → `user.center_id === cls.center_id`
- `teacher` → must have an active row in `class_teachers` for `(cls.id, user.id)`

**Teacher scoping in `listClasses`:** teachers receive only their assigned classes (via `listClassesForTeacher`); managers and super_admin receive all classes in the center.

**Homework criteria ownership:** for `teacher` role, all criteria write operations (`createCriteria`, `updateCriteria`, `deleteCriteria`) require the teacher to have an active `class_teachers` row for the class — checked via `getClassTeacherEntry` before any mutation.

**Critical constraint — criteria soft-delete:** `deleteCriteria` calls `deactivateCriteria` which sets `is_active=false`. The `homework_scores` rows referencing a deactivated `criteria_id` are **never touched** — they remain intact so historical reports remain accurate. The `progress.service.js` `getActiveHomeworkCriteria` query already filters `is_active=true`, so deactivated criteria are excluded from future session validation automatically.

---

## Enrollments Module

**Route prefix:** `/api/v1`  
**Mount:** `app.use('/api/v1', require('./routes/enrollments'))`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/enrollments` | super_admin, center_manager | Enroll a student into a class |
| GET | `/classes/:class_id/enrollments` | super_admin, center_manager, teacher | List enrollments for a class |
| GET | `/students/:user_id/enrollments` | any authenticated | List all enrollments for a student |
| PATCH | `/enrollments/:enrollment_id` | super_admin, center_manager | Update enrollment (withdraw, etc.) |

### Zod schemas (`src/routes/enrollments.js`)

**createEnrollmentSchema**
```js
{
  student_user_id: z.string().uuid(),           // required
  class_id:        z.string().uuid(),           // required
  enrolled_on:     z.string().date().optional(),// defaults to today
  prior_level:     z.string().max(100).optional(),
  notes_ur:        z.string().optional(),
}
```

**updateEnrollmentSchema**
```js
{
  status:       z.enum(['active', 'withdrawn']).optional(),
  withdrawn_on: z.string().date().optional(),   // auto-set to today if not provided
  prior_level:  z.string().max(100).optional(),
  notes_ur:     z.string().optional(),
}
// .refine: at least one field required
```

### Repository (`src/repositories/enrollments.repository.js`)

| Function | Description |
|----------|-------------|
| `getEnrollmentById(enrollmentId)` | Single row by PK |
| `getActiveEnrollmentForStudent(classId, studentUserId)` | Returns active enrollment row for duplicate check |
| `countActiveEnrollments(classId)` | Count of `status='active' AND is_active=true` rows — for capacity check |
| `listEnrollmentsByClass(classId, { status })` | Joins `users` for student profile; optional `status` filter |
| `listEnrollmentsByStudent(studentUserId)` | Joins `classes` for class name; ordered by `enrolled_on DESC` |
| `createEnrollment(data)` | Insert + returning |
| `updateEnrollment(enrollmentId, data)` | Update + `updated_at` + returning |

### Service (`src/services/enrollments.service.js`)

**`assertCenterAccess(user, centerId)`** — 403 if `center_manager`'s `center_id` does not match.

**`createEnrollment({ user, body })`**
1. Fetch class (404 if not found or inactive)
2. `assertCenterAccess(user, cls.center_id)` — center_manager scoping
3. `getActiveEnrollmentForStudent` → 409 `ENROLLMENT_CONFLICT` if found
4. If `cls.max_capacity != null`: `countActiveEnrollments` → 409 `CLASS_FULL` if `count >= max_capacity`
5. Inserts with `center_id` copied from the class row; `enrolled_on` defaults to today

**`listEnrollmentsByClass({ user, classId, query })`**
- Validates class exists (404); checks `user.center_id === cls.center_id` for non-super_admin
- Passes `query.status` filter to repository

**`listEnrollmentsByStudent({ user, studentUserId })`**
- No additional access guard beyond authentication — all authenticated roles may list

**`updateEnrollment({ user, enrollmentId, body })`**
- Validates enrollment exists (404)
- `assertCenterAccess(user, enrollment.center_id)`
- If `body.status === 'withdrawn'` and no `body.withdrawn_on` supplied → injects today's date

### Error codes specific to this module

| Code | Status | Condition |
|------|--------|-----------|
| `ENROLLMENT_CONFLICT` | 409 | Student already has an active enrollment in the class |
| `CLASS_FULL` | 409 | Active enrollment count ≥ `classes.max_capacity` |

---

## Attendance Module

**Route prefix:** `/api/v1`  
**Mount:** `app.use('/api/v1', require('./routes/attendance'))`

### Migration addendum — `009_attendance_corrections.js`

Adds two columns to `attendance_records` to record post-hoc corrections:

| Column | Type | Description |
|--------|------|-------------|
| `corrected_by` | `uuid FK → users` | User who made the correction |
| `corrected_at` | `timestamp` | When the correction was made |

Both are nullable; only set by `PATCH /attendance/sessions/:session_id/records/:record_id`.

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/classes/:class_id/attendance` | super_admin, center_manager, teacher | Create session + bulk-mark records |
| GET | `/classes/:class_id/attendance` | super_admin, center_manager, teacher | List sessions for a class |
| PATCH | `/attendance/sessions/:session_id/records/:record_id` | super_admin, center_manager, teacher | Correct a single record |
| GET | `/students/:user_id/attendance` | any authenticated | Get student's attendance summary |

### Zod schemas (`src/routes/attendance.js`)

**createSessionSchema**
```js
{
  session_date: z.string().date(),            // required — YYYY-MM-DD
  records: z.array({
    student_user_id: z.string().uuid(),
    status: z.enum(['present', 'absent', 'late']),
    note_ur: z.string().optional(),
  }).min(1),
}
```

**correctRecordSchema**
```js
{
  status:  z.enum(['present', 'absent', 'late']).optional(),
  note_ur: z.string().optional(),
}
// .refine: at least one field required
```

### Repository (`src/repositories/attendance.repository.js`)

| Function | Description |
|----------|-------------|
| `getSessionByClassAndDate(classId, sessionDate)` | Duplicate guard — returns existing session if one exists |
| `getSessionById(sessionId)` | Single session row by PK |
| `createAttendanceSession(trx, data)` | Insert session within transaction |
| `bulkCreateAttendanceRecords(trx, rows)` | Bulk insert all records in same transaction |
| `listSessionsByClass(classId, { from, to })` | Sessions ordered by `session_date DESC`; optional date-range filter |
| `listRecordsBySession(sessionId)` | All active records for a session, joined with student profiles |
| `getAttendanceRecordById(recordId)` | Single record row |
| `updateAttendanceRecord(recordId, data)` | Patch + `updated_at` + returning |
| `getStudentAttendanceRecords(studentUserId, { classId, from, to })` | All records for a student joined with session metadata |

### Service (`src/services/attendance.service.js`)

**`assertTeacherOwnership(user, classId)`** — super_admin and center_manager always pass; `teacher` must have an active row in `class_teachers` for the class (via `classRepo.getClassTeacherEntry`).

**`createAttendanceSession({ user, classId, body })`**
1. Fetch class (404); `assertCenterAccess`; `assertTeacherOwnership`
2. `getSessionByClassAndDate` → 409 `SESSION_EXISTS` if found
3. **Transaction:** `INSERT attendance_sessions` → bulk `INSERT attendance_records`
4. Returns `{ session_id, session_date, total, present, absent, late }`

**`listSessionsByClass({ user, classId, query })`**
- Validates class (404); `assertCenterAccess`
- Calls `listSessionsByClass` with `?from` and `?to` filters
- For each session, fetches its records via `listRecordsBySession` and attaches them

**`correctRecord({ user, sessionId, recordId, body })`**
- Validates record exists and belongs to the session (404 otherwise)
- Fetches session → class → `assertCenterAccess` + `assertTeacherOwnership`
- Injects `corrected_by: user.id` and `corrected_at: new Date()` alongside the status/note update

**`getStudentAttendance({ user, studentUserId, query })`**
- Accepts `?class_id`, `?from`, `?to` filters
- Counts `present`, `absent`, `late` in JS from the returned records array
- `attendance_pct = (present / total_sessions) * 100` rounded to 1 decimal place
- Returns:
  ```json
  {
    "total_sessions": 48,
    "present": 42,
    "absent": 4,
    "late": 2,
    "attendance_pct": 87.5,
    "records": [...]
  }
  ```

### Error codes specific to this module

| Code | Status | Condition |
|------|--------|-----------|
| `SESSION_EXISTS` | 409 | An attendance session already exists for this class on this date |

---

## Progress Sessions Module

**Route prefix:** `/api/v1/progress-sessions`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/` | teacher, center_manager | Log a daily progress session |

### Request body — POST /

```json
{
  "enrollment_id": "uuid",
  "class_id": "uuid",
  "session_date": "2025-09-15",
  "classwork": {
    "topic_id": "uuid (optional)",
    "subtopic_id": "uuid (optional)",
    "grade": "excellent | good | average | revision (optional)",
    "note_ur": "optional Urdu note"
  },
  "homework": {
    "due_date": "YYYY-MM-DD (optional)",
    "overall_note_ur": "optional",
    "scores": [
      { "criteria_id": "uuid", "marks_obtained": 8, "note_ur": "optional" }
    ]
  }
}
```

### Response 201

```json
{
  "session_id": "uuid",
  "homework_entry_id": "uuid",
  "homework_total": 8,
  "homework_max": 10,
  "homework_pct": 80
}
```

### `src/services/progress.service.js` — 8-step flow

1. **Teacher ownership check** — `class_teachers` row for `(class_id, teacher_user_id)` must exist
2. **Enrollment validation** — enrollment exists, belongs to class, status = `active`
3. **Duplicate guard** — one session per `(enrollment_id, session_date)`; throws `409 CONFLICT`
4. **Criteria validation** — all `criteria_id` values must be active criteria for the class; `marks_obtained` ≤ `max_marks`; no duplicate `criteria_id` in the scores array
5. **Pre-compute totals** — `homework_total`, `homework_max`, `homework_pct` calculated before DB write
6. **Transaction** — `INSERT progress_sessions` → `INSERT homework_entries` → bulk `INSERT homework_scores` (all or nothing)
7. **Enqueue notification** — fire-and-forget `notifyGuardianQueue.add(...)` after transaction commit
8. **Return** computed totals + IDs

---

## Jobs & Workers

### `src/jobs/notifyGuardian.js`

Bull queue named `notify-guardian`. Default job options:

```js
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }, // 5s → 25s → 125s
  removeOnComplete: true,
  removeOnFail: false,
}
```

Job payload shape:
```js
{
  session_id, student_user_id, student_name, student_name_ur,
  class_id, session_date, cw_grade,
  homework_entry_id, homework_total, homework_max, homework_pct,
  guardians: [{ full_name, full_name_ur, phone, whatsapp, preferred_lang, relation, is_primary }]
}
```

### `src/workers/whatsappWorker.js`

Stub worker that registers a processor on the `notify-guardian` queue. Implement the actual WhatsApp dispatch logic here.

---

## Error Codes Reference

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Missing or malformed Authorization header |
| `TOKEN_EXPIRED` | 401 | Access token past expiry |
| `INVALID_TOKEN` | 401 | Token fails signature verification or wrong type |
| `TOKEN_REVOKED` | 401 | JTI found in Redis revocation set |
| `INVALID_CREDENTIALS` | 401 | Wrong phone/password (identical message prevents enumeration) |
| `FORBIDDEN` | 403 | Authenticated but insufficient role or wrong center |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate (progress session, role assignment, guardian link) |
| `ENROLLMENT_CONFLICT` | 409 | Student already has an active enrollment in the class |
| `CLASS_FULL` | 409 | Active enrollment count ≥ `classes.max_capacity` |
| `SESSION_EXISTS` | 409 | Attendance session already exists for this class on this date |
| `VALIDATION_ERROR` | 400 | Zod schema failure; includes `field` |
| `RATE_LIMIT_EXCEEDED` | 429 | Express rate-limiter triggered |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled exception |

All error responses follow this shape:
```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "English description",
    "message_ur": "اردو وضاحت",
    "field": "field_name",
    "status": 400
  }
}
```
`field` is only present on `VALIDATION_ERROR`.

---

## RBAC Summary

| Role | Center scope | Typical capabilities |
|------|-------------|---------------------|
| `super_admin` | None (`center_id = null` in user_roles) | Full access to all resources, all centers |
| `center_manager` | Single center | Manage users/classrooms/classes within their center |
| `teacher` | Single center | Read classrooms, log progress sessions for their classes |
| `student` | Single center | Own profile only |
| `guardian` | Via student | Own profile; receives notifications |

**Middleware chain pattern used on every protected route:**
```js
router.verb('/path', requireAuth, requireRoles('role1', 'role2'), validate(schema), controller.fn);
```

**Service-level center enforcement** (beyond RBAC middleware):
- `assertCenterAccess(user, centerId)` — centers module; checks `user.center_id === centerId`
- `assertCenterScope(user, centerId)` — users module; same pattern, different name
- Both: super_admin always passes; non-super_admin must match exactly
