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
14. [Assessments Module](#assessments-module)
15. [Reports Module](#reports-module)
16. [Jobs & Workers](#jobs--workers)
17. [Error Codes Reference](#error-codes-reference)
18. [RBAC Summary](#rbac-summary)
19. [Frontend Architecture](#frontend-architecture)

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
    assessments.repository.js
    reports.repository.js

  services/                     Business logic
    auth.service.js
    centers.service.js
    users.service.js
    courses.service.js
    classes.service.js
    enrollments.service.js
    attendance.service.js
    progress.service.js
    assessments.service.js
    reports.service.js

  controllers/                  Thin req/res wrappers — parse req, call service, send res
    auth.controller.js
    centers.controller.js
    users.controller.js
    courses.controller.js
    classes.controller.js
    enrollments.controller.js
    attendance.controller.js
    progress.controller.js
    assessments.controller.js
    reports.controller.js

  routes/                       Express routers with Zod schemas and RBAC
    auth.js                     → mounted at /api/v1/auth
    centers.js                  → mounted at /api/v1
    users.js                    → mounted at /api/v1
    courses.js                  → mounted at /api/v1
    classes.js                  → mounted at /api/v1
    enrollments.js              → mounted at /api/v1
    attendance.js               → mounted at /api/v1
    progress.js                 → mounted at /api/v1 (routes carry full paths: /progress-sessions, /homework-entries, etc.)
    assessments.js              → mounted at /api/v1
    reports.js                  → mounted at /api/v1 (routes carry full paths: /reports/org/overview, etc.)

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

Also mounted at `/api/v1`: `enrollments`, `attendance`, `progress`, `assessments`, `reports`

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

### `src/utils/reportCache.js`

Redis-backed cache helpers for all report endpoints. Import path: `../utils/reportCache`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `TTL` | `{ ORG_OVERVIEW: 300, CENTER_OVERVIEW: 180, STUDENT_SUMMARY: 120 }` | TTL constants in seconds |
| `keys.orgOverview()` | `() → string` | `'report:org:overview'` |
| `keys.centerOverview(id, month)` | `(id, month?) → string` | `'report:center:{id}:{month|all}'` |
| `keys.studentSummary(id)` | `(id) → string` | `'report:student:{id}'` |
| `getCached(key)` | `async (key) → data \| null` | JSON.parse from Redis; returns null on miss or Redis error |
| `setCached(key, data, ttl)` | `async (key, data, ttl)` | JSON.stringify + SET EX; swallows Redis errors |
| `invalidateCenterReports(centerId)` | `async (centerId)` | Deletes `report:org:overview` + scans/deletes all `report:center:{id}:*` keys |
| `invalidateStudentReport(studentUserId)` | `async (userId)` | Deletes `report:student:{id}` |

Both invalidation functions are fire-and-forget (called with `.catch(console.error)`) — a Redis failure never blocks a write operation.

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

## Progress & Homework Module

**Route prefix:** `/api/v1`  
**Mount:** `app.use('/api/v1', require('./routes/progress'))`  
_(previously mounted at `/api/v1/progress-sessions`; remounted at `/api/v1` when remaining endpoints were added — `POST /api/v1/progress-sessions` is unchanged)_

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/progress-sessions` | teacher, center_manager | Log a daily progress session |
| GET | `/progress-sessions/:session_id` | super_admin, center_manager, teacher | Get session with homework entry + scores |
| PATCH | `/progress-sessions/:session_id` | super_admin, center_manager, teacher | Correct classwork fields |
| GET | `/students/:user_id/progress` | any authenticated | Student's full progress history |
| PATCH | `/homework-entries/:entry_id` | super_admin, center_manager, teacher | Update submission status or overall note |
| PATCH | `/homework-entries/:entry_id/scores/:score_id` | super_admin, center_manager, teacher | Correct a single score |

### Zod schemas (`src/routes/progress.js`)

**createProgressSessionSchema**
```js
{
  enrollment_id: z.string().uuid(),
  class_id:      z.string().uuid(),
  session_date:  z.string().date(),
  classwork: {
    topic_id:    z.string().uuid().optional(),
    subtopic_id: z.string().uuid().optional(),
    grade:       z.enum(['excellent','good','average','revision']).optional(),
    note_ur:     z.string().optional(),
  },
  homework: {
    due_date:        z.string().date().optional(),
    overall_note_ur: z.string().optional(),
    scores: z.array({ criteria_id, marks_obtained: int ≥ 0, note_ur? }).min(1),
  },
}
```

**updateProgressSessionSchema** — any subset of `cw_topic_id`, `cw_subtopic_id`, `cw_grade`, `cw_note_ur`; at least one field required.

**updateHomeworkEntrySchema** — any subset of `is_submitted` (bool), `due_date`, `overall_note_ur`; at least one field required.

**updateHomeworkScoreSchema** — any subset of `marks_obtained` (int ≥ 0), `note_ur`; at least one field required.

### Request / Response shapes

**POST /progress-sessions — Request**
```json
{
  "enrollment_id": "uuid",
  "class_id": "uuid",
  "session_date": "2026-04-13",
  "classwork": { "topic_id": "uuid", "grade": "good", "note_ur": "مخارج بہتر ہو رہے ہیں" },
  "homework": {
    "due_date": "2026-04-15",
    "overall_note_ur": "کل دوبارہ پڑھ کر آئیں",
    "scores": [
      { "criteria_id": "uuid", "marks_obtained": 8, "note_ur": "اچھی تلاوت" }
    ]
  }
}
```

**POST /progress-sessions — Response 201**
```json
{
  "session_id": "uuid",
  "homework_entry_id": "uuid",
  "homework_total": 19,
  "homework_max": 25,
  "homework_pct": 76.0
}
```
`homework_pct = sum(marks_obtained) / sum(max_marks) × 100` rounded to 1 decimal place.

**GET /progress-sessions/:session_id — Response 200**
```json
{
  "id": "uuid", "enrollment_id": "uuid", "class_id": "uuid",
  "teacher_user_id": "uuid", "session_date": "2026-04-13",
  "cw_topic_id": "uuid", "cw_grade": "good", "cw_note_ur": "...",
  "homework_entry": {
    "id": "uuid", "is_submitted": false, "due_date": "2026-04-15",
    "overall_note_ur": "...",
    "homework_total": 19, "homework_max": 25, "homework_pct": 76.0,
    "scores": [
      { "id": "uuid", "criteria_id": "uuid", "label_ur": "تلاوت کی درستی",
        "max_marks": 10, "marks_obtained": 8, "note_ur": "..." }
    ]
  }
}
```

**GET /students/:user_id/progress — Query params**
```
?class_id=uuid&from=2026-04-01&to=2026-04-30&include=homework_scores
```
Without `include=homework_scores` → returns sessions array without `homework_entry`. With it → each session includes a full `homework_entry` object with `scores` and computed totals (3 queries total, no N+1).

**PATCH /homework-entries/:entry_id/scores/:score_id — Response 200**
```json
{
  "id": "uuid", "criteria_id": "uuid", "label_ur": "...",
  "max_marks": 10, "marks_obtained": 9, "note_ur": "...",
  "homework_total": 20, "homework_max": 25, "homework_pct": 80.0
}
```
Returns the updated score with recomputed entry-level totals.

### `src/repositories/progress.repository.js`

| Function | Description |
|----------|-------------|
| `getClassTeacher(classId, teacherUserId)` | Ownership check — active `class_teachers` row |
| `getEnrollment(enrollmentId)` | Active enrollment row |
| `getActiveHomeworkCriteria(classId)` | Active criteria ordered by `display_order` |
| `getExistingSession(enrollmentId, sessionDate)` | Duplicate session guard |
| `getStudentById(userId)` | User profile (for notification payload) |
| `getGuardiansForStudent(studentUserId)` | Guardian contacts (for notification payload) |
| `getSessionById(sessionId)` | Single active progress session |
| `createProgressSession(trx, data)` | Insert within transaction |
| `updateProgressSession(sessionId, data)` | Patch + `updated_at` + returning |
| `listProgressByStudent(studentUserId, { classId, from, to })` | Sessions via enrollment join; filterable |
| `getHomeworkEntryBySessionId(sessionId)` | 1-to-1 entry for a session |
| `getHomeworkEntryById(entryId)` | Single entry row |
| `getHomeworkEntriesForSessions(sessionIds)` | Bulk fetch entries for multiple sessions |
| `createHomeworkEntry(trx, data)` | Insert within transaction |
| `updateHomeworkEntry(entryId, data)` | Patch + `updated_at` + returning |
| `getScoresByEntryId(entryId)` | Scores joined with criteria labels + max_marks; ordered by `display_order` |
| `getScoresForEntries(entryIds)` | Bulk fetch scores for multiple entries |
| `getHomeworkScoreById(scoreId)` | Single score joined with criteria (for bounds check) |
| `updateHomeworkScore(scoreId, data)` | Patch + `updated_at` + returning |
| `createHomeworkScores(trx, rows)` | Bulk insert within transaction |

### `src/services/progress.service.js`

**`computeTotals(scores)`** — internal helper. `homework_pct = Math.round((total / max) * 1000) / 10` (1 decimal).

**`assertWriteAccess(user, session)`** — super_admin passes; center_manager checks `center_id`; teacher checks `class_teachers`.

**`assertReadAccess(user, session)`** — same as write, but also passes if `session.teacher_user_id === user.id`.

**`createProgressSession` — 8-step flow:**
1. Teacher ownership check via `class_teachers`
2. Enrollment validation (exists, correct class, status = `active`)
3. Duplicate session guard: one per `(enrollment_id, session_date)` → `409 CONFLICT`
4. Criteria validation: each `criteria_id` must be active for the class; `marks_obtained ≤ max_marks`; no duplicate `criteria_id`
5. Pre-compute `homework_total`, `homework_max`, `homework_pct` in memory
6. **Single transaction:** `INSERT progress_sessions` → `INSERT homework_entries` → bulk `INSERT homework_scores`
7. Fire-and-forget `notifyGuardianQueue.add(...)` after transaction commit
8. Return `{ session_id, homework_entry_id, homework_total, homework_max, homework_pct }`

**`getStudentProgress` with `include=homework_scores`:** exactly 3 DB queries — sessions → entries bulk → scores bulk. Grouped in JS using Maps to avoid N+1.

**`updateHomeworkScore`:** after patching, fetches all remaining scores for the entry and recomputes totals, returning them alongside the updated score row.

---

## Assessments Module

**Route prefix:** `/api/v1`  
**Mount:** `app.use('/api/v1', require('./routes/assessments'))`

### Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/classes/:class_id/assessments` | teacher, center_manager | Create an assessment for a class |
| GET | `/classes/:class_id/assessments` | super_admin, center_manager, teacher | List assessments for a class |
| GET | `/assessments/:assessment_id` | super_admin, center_manager, teacher | Get a single assessment |
| POST | `/assessments/:assessment_id/results` | teacher, center_manager | Bulk-insert results (single transaction) |
| GET | `/assessments/:assessment_id/results` | super_admin, center_manager, teacher | List all results for an assessment |
| PATCH | `/assessments/:assessment_id/results/:result_id` | super_admin, center_manager, teacher | Correct a result |
| GET | `/students/:user_id/assessments` | any authenticated | Student's full assessment history |

### Zod schemas (`src/routes/assessments.js`)

**createAssessmentSchema**
```js
{
  title:           z.string().min(1),
  title_ur:        z.string().optional(),
  type:            z.enum(['written', 'oral', 'topic_test']).optional(),
  assessment_date: z.string().date().optional(),
  max_score:       z.number().int().min(0).optional(),
  instructions_ur: z.string().optional(),
}
```

**createResultsSchema — per-item shape (resultItemSchema)**
```js
{
  student_user_id:    z.string().uuid(),
  examiner_user_id:   z.string().uuid().optional(), // defaults to req.user.id
  score:              z.number().int().min(0).optional(),
  oral_grade:         z.enum(['excellent', 'good', 'average', 'fail']).optional(),
  topic_tested_id:    z.string().uuid().optional(),
  subtopic_tested_id: z.string().uuid().optional(),
  remarks_ur:         z.string().optional(),
  remarks_ar:         z.string().optional(),
}
// .refine: exactly one of score or oral_grade must be present (not both, not neither)
```

**updateResultSchema** — any subset of `score`, `oral_grade`, `topic_tested_id`, `subtopic_tested_id`, `remarks_ur`, `remarks_ar`; at least one field required.

### Business rules

**oral/written mutual exclusivity:**
- Enforced in two layers:
  1. **Zod** (`resultItemSchema.refine`): exactly one of `score` / `oral_grade` must be present in each result object.
  2. **Service** (`assertTypeGradeConsistency`): after fetching the assessment from DB, re-validates against `assessment.type`:
     - `type === 'oral'` → `oral_grade` required, `score` must be absent
     - `type === 'written'` or `type === 'topic_test'` → `score` required, `oral_grade` must be absent

**409 RESULT_EXISTS:** thrown when a `(assessment_id, student_user_id)` row already exists in `assessment_results` (unique constraint in migration 008).

**Duplicate-in-request guard:** if the same `student_user_id` appears twice in the `results` array, throws `400 VALIDATION_ERROR` before any DB writes.

**Score ceiling check:** if `assessment.max_score` is set and `score > max_score`, throws `400 VALIDATION_ERROR` (applies to both POST /results and PATCH /results/:result_id).

**Access control (`assertWriteAccess` / `assertReadAccess`):**
- `super_admin` → always passes
- `center_manager` → `user.center_id` must match `class.center_id`
- `teacher` → must have an active `class_teachers` row for the assessment's `class_id`
- All others → `403 FORBIDDEN`
- Both write and read use identical logic (`assertReadAccess = assertWriteAccess`).

### Request / Response shapes

**POST /classes/:class_id/assessments — Request**
```json
{
  "title": "Mid-Term Hifz Test",
  "title_ur": "درمیانی مدتی حفظ ٹیسٹ",
  "type": "written",
  "assessment_date": "2026-05-01",
  "max_score": 100,
  "instructions_ur": "سورہ بقرہ کی تلاوت لازمی ہے"
}
```

**POST /assessments/:assessment_id/results — Request (bulk)**
```json
{
  "results": [
    {
      "student_user_id": "uuid",
      "score": 85,
      "topic_tested_id": "uuid",
      "remarks_ur": "بہت اچھی تلاوت"
    },
    {
      "student_user_id": "uuid2",
      "score": 72
    }
  ]
}
```
For oral assessments replace `score` with `oral_grade: "excellent"`.

**GET /assessments/:assessment_id/results — Response 200**
```json
[
  {
    "id": "uuid",
    "assessment_id": "uuid",
    "student_user_id": "uuid",
    "student_full_name": "Aisha Khan",
    "student_full_name_ur": "عائشہ خان",
    "examiner_user_id": "uuid",
    "score": 85,
    "oral_grade": null,
    "topic_tested_id": "uuid",
    "subtopic_tested_id": null,
    "remarks_ur": "بہت اچھی تلاوت",
    "remarks_ar": null,
    "created_at": "...",
    "updated_at": "..."
  }
]
```

**GET /students/:user_id/assessments — Query params**
```
?class_id=uuid&from=YYYY-MM-DD&to=YYYY-MM-DD
```
Returns a flat array of assessment + result data joined together — no second query needed.

### `src/repositories/assessments.repository.js`

| Function | Description |
|----------|-------------|
| `listAssessmentsByClass(classId, { from, to })` | Active assessments for a class, optionally date-filtered, ordered by `assessment_date DESC` |
| `getAssessmentById(assessmentId)` | Single active assessment row |
| `createAssessment(data)` | Insert + `RETURNING *` |
| `getResultByStudentAndAssessment(assessmentId, studentUserId)` | Duplicate guard for 409 RESULT_EXISTS |
| `getResultById(resultId)` | Single active result row |
| `listResultsByAssessment(assessmentId)` | Results joined with `users` for `student_full_name` / `student_full_name_ur`; ordered by student name |
| `listAssessmentsByStudent(studentUserId, { classId, from, to })` | Joins `assessment_results` → `assessments`; flat rows with both assessment and result fields |
| `bulkCreateResults(trx, rows)` | Bulk insert within transaction, `RETURNING *` |
| `updateResult(resultId, data)` | Patch + `updated_at` + `RETURNING *` |

### `src/services/assessments.service.js`

**`assertTypeGradeConsistency(assessmentType, result)`** — enforces oral/written mutual exclusivity at the service layer (second check after Zod). Throws `400 VALIDATION_ERROR` with `field: 'score'` or `field: 'oral_grade'`.

**`createResults` — flow:**
1. Fetch assessment; `assertWriteAccess`
2. `assertTypeGradeConsistency` for every result item
3. Detect duplicate `student_user_id` within the request array → `400 VALIDATION_ERROR`
4. Check each student for existing result → `409 RESULT_EXISTS`
5. Score ceiling check (if `assessment.max_score != null`)
6. Single `db.transaction` → `bulkCreateResults`

**`updateResult` — flow:**
1. Fetch assessment + result; verify `result.assessment_id === assessmentId`
2. Merge proposed values with existing values → `assertTypeGradeConsistency` on merged object (prevents clearing `oral_grade` from an oral assessment)
3. Score ceiling check if `score` is being updated
4. `repo.updateResult`

---

## Reports Module

**Route prefix:** `/api/v1`  
**Mount:** `app.use('/api/v1', require('./routes/reports'))`  
Read-only, no side effects. All responses may be served from Redis cache.

### Endpoints

| Method | Path | Roles | Cache TTL | Cache key |
|--------|------|-------|-----------|-----------|
| GET | `/reports/org/overview` | super_admin | 5 min | `report:org:overview` |
| GET | `/reports/centers/:center_id/overview` | super_admin, center_manager | 3 min | `report:center:{id}:{month\|all}` |
| GET | `/reports/students/:user_id/summary` | any authenticated | 2 min | `report:student:{id}` |
| GET | `/reports/classes/:class_id/homework-performance` | super_admin, center_manager, teacher | none | — |

### Cache invalidation triggers

| Write event | Keys invalidated |
|-------------|-----------------|
| `POST /classes/:class_id/attendance` (new attendance session) | `report:org:overview` + all `report:center:{center_id}:*` |
| `POST /progress-sessions` (new progress session) | `report:org:overview` + all `report:center:{center_id}:*` + `report:student:{student_user_id}` |

Both calls are fire-and-forget in the respective write services, so a Redis failure never blocks attendance or progress creation.

### Query params

```
GET /reports/centers/:center_id/overview?month=2026-04
GET /reports/classes/:class_id/homework-performance?from=2026-04-01&to=2026-04-30
```

`month` is `YYYY-MM` format. The service expands it to `from=YYYY-MM-01`, `to=YYYY-MM-{last_day}` before querying.

### Response shapes

**GET /reports/org/overview — Response 200**
```json
{
  "total_students": 1284,
  "total_teachers": 64,
  "active_centers": 7,
  "avg_attendance_pct": 78.2,
  "enrollments_by_course": [
    { "course": "Hifz ul Quran", "course_ur": "حفظ القرآن", "count": 342 }
  ]
}
```
`avg_attendance_pct` = all-time present / all records × 100, rounded to 1 decimal.

**GET /reports/centers/:center_id/overview?month=2026-04 — Response 200**
```json
{
  "active_students": 142,
  "active_teachers": 8,
  "active_classes": 12,
  "attendance_pct": 83.4,
  "total_attendance_records": 1120,
  "progress_sessions": 340,
  "period": { "month": "2026-04", "from": "2026-04-01", "to": "2026-04-30" }
}
```
Without `?month`: `"period": { "all_time": true }` and all counts are unfiltered.

**GET /reports/students/:user_id/summary — Response 200**
```json
{
  "student": {
    "id": "uuid",
    "full_name": "Hamza Rauf",
    "full_name_ur": "حمزہ رؤف",
    "display_name_ar": null,
    "phone": "+923001234567",
    "preferred_lang": "ur"
  },
  "attendance_pct": 88.0,
  "classwork_grades": { "excellent": 12, "good": 8, "average": 3, "revision": 1 },
  "homework_avg_pct": 76.4,
  "topics_covered": [
    { "id": "uuid", "title": "Makharij al-Huruf", "title_ur": "مخارج الحروف", "title_ar": "مخارج الحروف" }
  ],
  "assessment_scores": [
    {
      "assessment_id": "uuid", "title": "Monthly Test", "title_ur": "ماہانہ ٹیسٹ",
      "type": "written", "assessment_date": "2026-04-20", "max_score": 50,
      "score": 42, "oral_grade": null, "remarks_ur": "ممتاز"
    }
  ]
}
```
`homework_avg_pct = sum(marks_obtained) / sum(max_marks) × 100` across all sessions. `classwork_grades` always includes all four keys (`excellent`, `good`, `average`, `revision`) even if zero.

**GET /reports/classes/:class_id/homework-performance — Response 200**
```json
{
  "criteria": [
    {
      "criteria_id": "uuid",
      "label": "Recitation accuracy",
      "label_ur": "تلاوت کی درستی",
      "max_marks": 10,
      "class_avg": 7.8,
      "lowest": 4,
      "highest": 10,
      "submission_count": 56
    }
  ]
}
```
Criteria ordered by `homework_criteria.display_order ASC`. `lowest`/`highest` are `null` if no scores exist.

### `src/repositories/reports.repository.js`

| Function | Description |
|----------|-------------|
| `countActiveStudents()` | Distinct users with `role='student'` and `is_active=true` |
| `countActiveTeachers()` | Distinct users with `role='teacher'` and `is_active=true` |
| `countActiveCenters()` | Count of `centers` where `is_active=true` |
| `getOrgAttendanceStats()` | All-time `total` + `present_count` from `attendance_records` |
| `getEnrollmentsByCourse()` | Active enrollments grouped by course name, ordered by count DESC |
| `getCenterActiveStudentCount(centerId)` | Distinct `student_user_id` in active enrollments for this center |
| `getCenterActiveTeacherCount(centerId)` | Distinct teachers with an active `class_teachers` row in this center |
| `getCenterClassCount(centerId)` | Active classes for this center |
| `getCenterAttendanceStats(centerId, { from, to })` | `total` + `present_count` filtered by `attendance_sessions.center_id` and optional date range |
| `getCenterProgressSessionCount(centerId, { from, to })` | Count of progress sessions joined to classes → center |
| `getStudentProfile(userId)` | User row for student profile object |
| `getStudentAttendanceStats(userId)` | `total` + `present_count` for this student |
| `getStudentClassworkGrades(userId)` | `[{ grade, cnt }]` grouped by `progress_sessions.cw_grade` |
| `getStudentHomeworkStats(userId)` | `{ total_obtained, total_max }` summed across all homework |
| `getStudentTopicsCovered(userId)` | Distinct topics from `progress_sessions.cw_topic_id` → `topics` join |
| `getStudentAssessmentScores(userId)` | All result rows joined with assessment metadata |
| `getHomeworkPerformanceByClass(classId, { from, to })` | Per-criterion `class_avg`, `lowest`, `highest`, `submission_count`; uses PostgreSQL `ROUND(AVG(...)::numeric, 1)` |

### `src/services/reports.service.js`

**`parseMonth(month)`** — converts `"YYYY-MM"` → `{ from: "YYYY-MM-01", to: "YYYY-MM-{lastDay}" }`. Uses `new Date(y, m, 0).getDate()` to find the last day of the month without any library.

**Cache pattern (all cached endpoints):**
```js
const hit = await cache.getCached(cacheKey);
if (hit) return hit;
// ... run queries ...
await cache.setCached(cacheKey, result, TTL.XYZ);
return result;
```
`getCached`/`setCached` both swallow Redis errors — a Redis outage degrades to uncached (never throws).

**`getStudentSummary`** — throws `404 NOT_FOUND` if the student profile row doesn't exist (after the cache miss path).

**`getHomeworkPerformance`** — validates class exists + `assertCenterAccess` before querying. Not cached.

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
| `RESULT_EXISTS` | 409 | A result already exists for this student in the assessment |
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

---

## Frontend Architecture

React + Vite SPA located in `frontend/`. Connects to the backend REST API.

### Tech stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18 | UI framework |
| Vite | 5 | Build tool / dev server |
| react-router-dom | 6 | Client-side routing |
| @tanstack/react-query | 5 | Server state, caching, refetch |
| axios | 1 | HTTP client with interceptors |

### Folder structure

```
frontend/
  src/
    api/
      client.js           Axios instance — in-memory Bearer token, silent-refresh on 401,
                          auth:logout event dispatch on refresh failure
      auth.js             login, logout, refresh, getMe, changePassword
      centers.js          getOrg, updateOrg, getCenters, createCenter, getCenter, updateCenter,
                          getClassrooms, createClassroom, updateClassroom,
                          getCenterOverview, getCenterClasses
      courses.js          getCourses, createCourse, updateCourse,
                          getTopics, createTopic, updateTopic, deleteTopic,
                          createSubtopic, updateSubtopic, deleteSubtopic,
                          getCourseLevels, createCourseLevel, updateCourseLevel
      classes.js          getClasses, createClass, getClass, updateClass,
                          getClassTeachers, assignTeacher, removeTeacher,
                          getHomeworkCriteria, createCriterion, updateCriterion,
                          deactivateCriterion, getClassEnrollments
      users.js            getUsers, getUser, createUser, updateUser
      enrollments.js      createEnrollment, getClassEnrollments, getStudentEnrollments,
                          updateEnrollment
      attendance.js       createAttendanceSession, getClassAttendance, getSessionRecords,
                          updateRecord, getStudentAttendance

    context/
      AuthContext.jsx     AuthProvider — access_token in memory only; silent refresh on mount
                          via httpOnly cookie; exposes user, role, isAuthenticated, login, logout
      ToastContext.jsx    ToastProvider — portal-rendered toast stack; addToast(type, message, duration)

    hooks/
      useAuth.js          Thin useContext(AuthContext) wrapper
      useToast.js         { success, error, warning, toast } helpers over ToastContext
      useAttendance.js    useClassAttendance, useStudentAttendance, useMarkAttendance, useCorrectRecord

    components/
      ProtectedRoute.jsx  Layout route guard — redirects to /signin if unauthenticated;
                          renders a 403 view if user's role is not in the `roles` prop
      Button.jsx          variant: primary|outline|ghost  ·  size: sm|md|lg
      Card.jsx            Named exports: Card, CardHeader, CardBody, CardFooter
      Badge.jsx           variant: green|gold|blue|red|sand|purple
      MetricCard.jsx      label, value, sub, variant: green|gold|blue|neutral
      DataTable.jsx       columns config, rows, loading, emptyTitle, emptyDescription
      PageHeader.jsx      title, subtitle, optional action: { label, onClick, variant }
      Modal.jsx           open, title, size: sm|md|lg, onClose — rendered via portal
      ProgressBar.jsx     value 0–100, variant: green|gold|blue|neutral|red, height
      EmptyState.jsx      icon, title, description, optional action: { label, onClick }
      LoadingSpinner.jsx  size, color — injects keyframe on first render
      RTLInput.jsx        Urdu/Arabic text input; multiline prop renders textarea

    layouts/
      AuthLayout.jsx      Redirects authenticated users to /; renders <Outlet> otherwise
      AppShell.jsx        Sidebar + topbar shell — pure layout, no auth logic
                          Nav sections driven by role from AuthContext

    pages/
      auth/
        SignIn.jsx           Split-panel sign-in page: form + demo role cards; tab links to /signup
        SignUp.jsx           Split-panel registration page with success state after account creation
      admin/
        Dashboard.jsx        Org overview metrics (calls GET /reports/org/overview)
        Centers/
          CentersList.jsx    Centers table with per-center stats; super_admin only;
                             center_manager auto-redirected to their own center detail
          CenterDetail.jsx   3-tab view: Overview (metrics + classes), Classrooms (inline edit),
                             Settings (bilingual form); accessible to super_admin + center_manager
          AddCenterModal.jsx Modal form for POST /centers — invalidates query + shows toast
        Org/
          OrgSettings.jsx    GET /org + PATCH /org form; bilingual fields with RTLInput
        Courses/
          CoursesList.jsx    3-column card grid; course type chips; "Manage topics" / "Edit" actions
          CourseDetail.jsx   3-tab view: Topics (TopicManager), Levels (table + form), Classes (info panel)
          TopicManager.jsx   Split-panel: left 40% topic list with delete confirm, right 60% subtopic editor
          AddCourseModal.jsx Modal form for POST /courses — invalidates query + toast
          EditCourseModal.jsx Modal form for PATCH /courses/:id — pre-populated from course data
      manager/
        Classes/
          ClassesList.jsx    Table with filter bar (course dropdown, active/all toggle); capacity color coding;
                             row-click navigates to ClassDetail; center_manager scoped to user.center_id
          ClassDetail.jsx    4-tab view: Students, Teachers (assign/remove), Homework Criteria, Schedule
          AddClassModal.jsx  POST /centers/:id/classes; day multi-select; level dropdown loads after course chosen;
                             on create navigates to new ClassDetail
        Enrollments/
          EnrollmentsList.jsx  Class dropdown + status toggle (active/withdrawn/all) + name search;
                               client-side filtering; Withdraw action opens WithdrawModal
          EnrollmentForm.jsx   Two-column layout: student details (left) + course/class/prior knowledge (right);
                               two-step submit: POST /users then POST /enrollments;
                               handles 409 ENROLLMENT_CONFLICT and CLASS_FULL inline
          WithdrawModal.jsx    PATCH /enrollments/:id {status: withdrawn}; withdrawal date + optional Urdu reason
      teacher/
        Attendance/
          MarkAttendance.jsx   Class+date selector → roster with P/A/L toggle buttons; absent note field;
                               live summary header; sticky bottom bar; gold banner if editing existing session
          AttendanceSheet.jsx  Week/month grid; per-student % column; per-day % header; inline record correction;
                               CSV export with BOM for Urdu text
      student/
        Attendance/
          MyAttendance.jsx     4 MetricCards (Present/Absent/Late/Attendance%); monthly calendar grid;
                               scrollable session history table (descending date order)
      Placeholder.jsx        Stub for routes not yet implemented

    styles/
      tokens.css          All CSS custom properties (colors, fonts, radii, shadows, sizing vars)
      globals.css         All reusable component classes (auth, sidebar, topbar, cards, table,
                          chips, progress bar, form controls, buttons, attendance grid)
```

### Shared component library

All components are in `frontend/src/components/` and use inline styles driven exclusively by CSS custom properties from `tokens.css`. No CSS modules or external UI library.

#### Button

```jsx
<Button variant="primary" size="md" onClick={fn} disabled={false}>Label</Button>
```

| Prop | Values | Default |
|------|--------|---------|
| `variant` | `primary` `outline` `ghost` | `primary` |
| `size` | `sm` `md` `lg` | `md` |
| `disabled` | boolean | `false` |
| `type` | html button type | `button` |

Passes any extra HTML button props through via `{...rest}`.

#### Card / CardHeader / CardBody / CardFooter

Named exports — compose freely:

```jsx
import { Card, CardHeader, CardBody, CardFooter } from '../components/Card';

<Card>
  <CardHeader>
    <span className="card-title">Title</span>
    <button className="card-action">Action</button>
  </CardHeader>
  <CardBody>content</CardBody>
  <CardFooter><Button>Save</Button></CardFooter>
</Card>
```

`CardFooter` renders a right-aligned flex row with a top border. All slots accept a `style` override prop.

#### Badge

```jsx
<Badge variant="green">Active</Badge>
<Badge variant="purple">Super Admin</Badge>
```

Variants: `green` `gold` `blue` `red` `sand` `purple`. Maps directly to the design's chip colour set.

#### MetricCard

```jsx
<MetricCard label="Total students" value="1,284" sub="↑ 48 this month" variant="green" />
```

Renders the 3px top colour bar automatically from `variant`. All four variants (`green` `gold` `blue` `neutral`) are supported.

#### DataTable

```jsx
const columns = [
  { key: 'name',   label: 'Name' },
  { key: 'status', label: 'Status', render: (val) => <Badge variant="green">{val}</Badge> },
];

<DataTable columns={columns} rows={data} loading={isLoading} emptyTitle="No centers yet" />
```

`render(value, row)` receives the cell value and the full row object. Shows `LoadingSpinner` while `loading=true` and `EmptyState` when `rows` is empty.

#### PageHeader

```jsx
<PageHeader
  title="Centers"
  subtitle="All Quran Foundation learning centers"
  action={{ label: '+ New center', onClick: openModal }}
/>
```

`action.variant` defaults to `'primary'`; pass `'outline'` or `'ghost'` to override.

#### Modal

```jsx
<Modal open={show} title="Edit center" size="md" onClose={() => setShow(false)}>
  <form>...</form>
</Modal>
```

Rendered via `createPortal` into `document.body`. Closes on Escape key or overlay click. Body slot is scrollable independently of the header. `size` controls `maxWidth`: `sm=400`, `md=520`, `lg=720`.

#### Toast / useToast

`ToastProvider` must wrap the app (already done in `App.jsx`). Use the hook anywhere inside:

```jsx
const toast = useToast();

toast.success('Center created.');
toast.error('Failed to save changes.');
toast.warning('Capacity almost full.');
toast.toast({ type: 'success', message: '...', duration: 6000 }); // custom duration
```

Toasts render bottom-right via a portal. Default `duration` is 4000 ms; pass `duration: 0` to make a toast persist until dismissed manually.

#### ProgressBar

```jsx
<ProgressBar value={76} variant="green" height={6} />
```

`value` is clamped to 0–100. The green variant uses the emerald gradient from the design. Pass `height` in pixels to adjust thickness (default 6).

#### EmptyState

```jsx
<EmptyState
  icon="⊙"
  title="No centers yet"
  description="Create the first center to get started."
  action={{ label: '+ New center', onClick: openModal }}
/>
```

The `action` renders an `outline` Button below the description.

#### LoadingSpinner

```jsx
<LoadingSpinner size={24} color="var(--emerald)" />
```

Injects its `@keyframes spin` rule into `<head>` on first render (once only). Safe to render multiple instances.

#### RTLInput

```jsx
{/* Single-line */}
<RTLInput placeholder="حمزہ رؤف" value={val} onChange={(e) => setVal(e.target.value)} />

{/* Multi-line */}
<RTLInput multiline rows={3} placeholder="نوٹ لکھیں" value={note} onChange={...} />
```

Applies `dir="rtl"` and `font-family: var(--font-display)` (Amiri) automatically. Exposes the emerald focus ring on focus. Pass any additional HTML `input` / `textarea` props via `{...rest}`.

### Centers & Org frontend module

#### `frontend/src/api/centers.js` — full export list

| Export | HTTP | Description |
|--------|------|-------------|
| `getOrg()` | `GET /org` | Fetch org profile |
| `updateOrg(payload)` | `PATCH /org` | Update org settings |
| `getCenters(params)` | `GET /centers` | List centers; accepts `?is_active`, `?city`, `?page`, `?per_page` |
| `createCenter(payload)` | `POST /centers` | Create a center |
| `getCenter(centerId)` | `GET /centers/:id` | Single center row |
| `updateCenter(centerId, payload)` | `PATCH /centers/:id` | Patch center fields |
| `getClassrooms(centerId)` | `GET /centers/:id/classrooms` | List classrooms |
| `createClassroom(centerId, payload)` | `POST /centers/:id/classrooms` | Add a classroom |
| `updateClassroom(centerId, classroomId, payload)` | `PATCH /centers/:id/classrooms/:roomId` | Update a classroom |
| `getCenterOverview(centerId, params)` | `GET /reports/centers/:id/overview` | Per-center stats (students, classes, attendance %) |
| `getCenterClasses(centerId, params)` | `GET /centers/:id/classes` | Classes list for the overview tab |

#### `CentersList.jsx` — query pattern

Uses two react-query primitives in tandem:
```jsx
// 1. Fetch all centers
const { data } = useQuery({ queryKey: ['centers'], queryFn: getCenters });
const centers = data?.data ?? data ?? [];

// 2. Fetch per-center overview stats in parallel (N calls, one per center)
const reportQueries = useQueries({
  queries: centers.map((c) => ({
    queryKey: ['center-overview', c.id],
    queryFn:  () => getCenterOverview(c.id),
    staleTime: 3 * 60_000,
  })),
});
```
Report data is indexed by center ID and merged into the table rows. Stats columns show `—` while loading.

**Role guard:** `center_manager` visiting `/admin/centers` is immediately redirected to `/admin/centers/:their_center_id` via a `useEffect`.

#### `CenterDetail.jsx` — three tabs

| Tab | Data fetched | Key interactions |
|-----|-------------|-----------------|
| Overview | `getCenterOverview`, `getCenterClasses` | MetricCards (students, classes, attendance); classes table |
| Classrooms | `getClassrooms` | Inline edit: click name → input appears, Enter saves via `updateClassroom`; "Add classroom" row at top |
| Settings | center data from parent query | Bilingual form (English + Urdu side by side); Urdu fields use `RTLInput`; super_admin can toggle `is_active` |

**center_manager scoping:** if `user.center_id !== params.id`, the component redirects to the correct center.

#### `OrgSettings.jsx`

Fetches `GET /org`, pre-populates a controlled form, saves via `PATCH /org`. Fields: `name`, `name_ur` (RTLInput), `name_ar` (RTLInput), `contact_email`, `contact_phone`. Logo field is a placeholder (file upload deferred until storage backend is configured).

#### `AddCenterModal.jsx`

Wraps `Modal` (size `md`). On submit: calls `createCenter()` → invalidates `['centers']` query → calls `toast.success()` → closes. Error is shown inline in the modal. Resets form on close.

### Courses & Topics frontend module

#### `frontend/src/api/courses.js` — full export list

| Export | HTTP | Description |
|--------|------|-------------|
| `getCourses(params)` | `GET /courses` | List all courses; accessible to any authenticated user |
| `createCourse(payload)` | `POST /courses` | Create a course (super_admin) |
| `updateCourse(courseId, payload)` | `PATCH /courses/:id` | Update course fields |
| `getTopics(courseId)` | `GET /courses/:id/topics` | List topics with nested `subtopics[]` array |
| `createTopic(courseId, payload)` | `POST /courses/:id/topics` | Add a topic (admin teacher) |
| `updateTopic(courseId, topicId, payload)` | `PATCH /courses/:id/topics/:tid` | Edit or reorder a topic |
| `deleteTopic(courseId, topicId)` | `DELETE /courses/:id/topics/:tid` | Soft-delete topic (`is_active=false`) |
| `createSubtopic(courseId, topicId, payload)` | `POST /courses/:id/topics/:tid/subtopics` | Add a subtopic |
| `updateSubtopic(courseId, topicId, subtopicId, payload)` | `PATCH /courses/:id/topics/:tid/subtopics/:sid` | Edit a subtopic |
| `deleteSubtopic(courseId, topicId, subtopicId)` | `DELETE /courses/:id/topics/:tid/subtopics/:sid` | Remove a subtopic |
| `getCourseLevels(courseId)` | `GET /courses/:id/levels` | List course levels |
| `createCourseLevel(courseId, payload)` | `POST /courses/:id/levels` | Add a level |
| `updateCourseLevel(courseId, levelId, payload)` | `PATCH /courses/:id/levels/:lid` | Edit a level |

#### `CoursesList.jsx` — card grid

- Fetches `GET /courses` via `useQuery(['courses'], getCourses)`.
- Renders a 3-column CSS grid of `CourseCard` components.
- **Type chips:** `hifz → chip-green`, `nazra → chip-blue`, `tajweed → chip-gold`, `arabic → chip-sand`.
- Each card shows: type chip, English name, Urdu name (RTL), description_ur (RTL), two action buttons.
- "Manage topics" navigates to `/admin/courses/:id`.
- "Edit" opens `EditCourseModal` with the course pre-loaded.
- "+" header button opens `AddCourseModal`.

#### `TopicManager.jsx` — split panel (embedded in `CourseDetail`)

Split-panel component that receives a `courseId` prop. Fetches `GET /courses/:id/topics` via `useQuery(['topics', courseId])`.

| Panel | Width | Content |
|-------|-------|---------|
| Left | 40% | Numbered topic list; click to select; delete button with inline confirm; "Add" form appears at top |
| Right | 60% | Selected topic's header + edit form (collapsible) + subtopic list with inline edit/delete + add form |

**State management:** all mutations call `qc.invalidateQueries(['topics', courseId])` on success — no optimistic updates needed as the list is small.

**Delete flow:** clicking ✕ on a topic shows an inline `ConfirmDelete` row (red banner with Cancel / Delete buttons) in-place before the actual delete call.

#### `CourseDetail.jsx` — three tabs

| Tab | Component | Data |
|-----|-----------|------|
| Topics | `<TopicManager courseId={id} />` | Embedded split-panel editor |
| Levels | `LevelsTab` inline | `useQuery(['course-levels', id], getCourseLevels)` — table + add/edit form toggled inline |
| Classes | `ClassesTab` inline | Static info panel (cross-center classes are managed per-center) |

Back-navigation "← Courses" button links to `/admin/courses`. The course data comes from the already-cached `['courses']` query (no extra request).

#### `AddCourseModal.jsx` / `EditCourseModal.jsx`

Both wrap `Modal` (size `md`). Fields: `name`, `name_ur` (RTLInput), `name_ar` (RTLInput), `type` (select: hifz/nazra/tajweed/arabic), `description_ur` (RTLInput multiline).

- **Add:** on submit calls `createCourse()` → invalidates `['courses']` → `toast.success` → closes; resets form on close.
- **Edit:** `useEffect` pre-populates from `course` prop; on submit calls `updateCourse(course.id, form)` → invalidates `['courses']` → `toast.success`.

#### Sidebar nav updates (`AppShell.jsx`)

| Role | Updated nav links |
|------|-----------------|
| `super_admin` | Centers → `/admin/centers`; Settings → `/admin/org` |
| `center_manager` | "My Center" item dynamically resolved to `/admin/centers/:user.center_id` at render time |

### Classes & Homework Criteria frontend module

#### `frontend/src/api/classes.js` — full export list

| Export | HTTP | Description |
|--------|------|-------------|
| `getClasses(centerId, params)` | `GET /centers/:id/classes` | List classes; `?course_id`, `?is_active` |
| `createClass(centerId, payload)` | `POST /centers/:id/classes` | Create class section |
| `getClass(classId)` | `GET /classes/:id` | Single class row |
| `updateClass(classId, payload)` | `PATCH /classes/:id` | Edit class fields |
| `getClassTeachers(classId)` | `GET /classes/:id/teachers` | Assigned teacher list |
| `assignTeacher(classId, payload)` | `POST /classes/:id/teachers` | Assign teacher; payload `{ teacher_user_id, is_primary, assigned_from }` |
| `removeTeacher(classId, teacherUserId)` | `DELETE /classes/:id/teachers/:uid` | Remove teacher |
| `getHomeworkCriteria(classId)` | `GET /classes/:id/homework-criteria` | All criteria (active + inactive) |
| `createCriterion(classId, payload)` | `POST /classes/:id/homework-criteria` | Add criterion |
| `updateCriterion(classId, criteriaId, payload)` | `PATCH /classes/:id/homework-criteria/:cid` | Edit criterion |
| `deactivateCriterion(classId, criteriaId)` | `PATCH …` with `{ is_active: false }` | Soft-deactivate |
| `getClassEnrollments(classId, params)` | `GET /classes/:id/enrollments` | Enrolled students; `?status=active` |

#### `frontend/src/api/users.js` — full export list

| Export | HTTP | Description |
|--------|------|-------------|
| `getUsers(params)` | `GET /users` | List users; `?center_id`, `?role`, `?search`, `?is_active`, `?page`, `?per_page` |
| `getUser(userId)` | `GET /users/:id` | Single user profile |
| `createUser(payload)` | `POST /users` | Create user |
| `updateUser(userId, payload)` | `PATCH /users/:id` | Update user |

#### `ClassesList.jsx`

- Fetches `GET /centers/:id/classes` scoped to `user.center_id` from AuthContext.
- **Filter bar:** course dropdown (`getCourses`) + Active/All toggle (two-button group).
- **Capacity color coding:** `enrolled/max < 0.8` → emerald; `0.8–0.99` → amber; `>= 1.0` → red.
- Schedule days rendered as small day chips. Row hover highlights. Row click navigates to `/classes/:id`.
- `AddClassModal` opened from header "+ Add class" button.

#### `ClassDetail.jsx` — four tabs

| Tab | Data fetched | Key interactions |
|-----|-------------|-----------------|
| Students | `getClassEnrollments` `?status=active` | Read-only table; "Enroll student" button is a stub (enrollment flow is separate) |
| Teachers | `getClassTeachers` | Assign via inline search (`getUsers ?role=teacher`); first assigned is auto-set as primary; remove with confirmation |
| Homework Criteria | `getHomeworkCriteria`, `getTopics` | Ordered table; inline add/edit form with topic dropdown and conditional subtopic dropdown; deactivate with one click (preserved in history); total marks counter |
| Schedule | class data | Visual day chips (active=emerald, inactive=sand); start time and days-per-week summary; class details card |

#### `AddClassModal.jsx`

Wraps `Modal` (size `md`). Fields:
- `name`, `name_ur` (RTLInput)
- `course_id` (select from `getCourses`); changing course resets `course_level_id`
- `course_level_id` (conditional select from `getCourseLevels(course_id)`; disabled until course chosen)
- `max_capacity` (number), `start_time` (time input)
- `schedule_days` (multi-select toggle buttons — Mon/Tue/Wed/Thu/Fri/Sat/Sun)

On create: calls `createClass(centerId, payload)` with `schedule_days` joined as comma-separated string → invalidates `['classes', centerId]` → navigates to `/classes/:newId`.

#### Homework Criteria UX rules

- Only active criteria are counted in the "Total: N marks" header.
- Inactive criteria still appear in the table (dimmed at 50% opacity) for audit visibility.
- The amber warning banner ("Deactivating a criterion will hide it from future sessions...") is shown whenever there are active criteria.
- The topic dropdown loads all topics for the class's `course_id` from `getTopics`. The subtopic dropdown is disabled until a topic with subtopics is selected.
- `display_order` auto-populated as `activeCriteria.length + 1` but editable.

### Enrollments frontend module

#### `frontend/src/api/enrollments.js` — full export list

| Export | HTTP | Description |
|--------|------|-------------|
| `createEnrollment(payload)` | `POST /enrollments` | Enroll a student into a class |
| `getClassEnrollments(classId, params)` | `GET /classes/:id/enrollments` | List students in a class; `?status=active` |
| `getStudentEnrollments(userId)` | `GET /students/:id/enrollments` | All classes a student is enrolled in |
| `updateEnrollment(enrollmentId, payload)` | `PATCH /enrollments/:id` | Withdraw or transfer; `{ status, withdrawn_on }` |

#### `EnrollmentForm.jsx` — two-step submit

This is a single-page form that creates a student and enrolls them in one submit:

1. **Step 1 — Create student:** `POST /users` with `role: 'student'` and `center_id: user.center_id`. Returns `{ id, full_name, temp_password }`.
2. **Step 2 — Enroll:** `POST /enrollments` with the new `student_user_id`, `class_id`, `center_id`, `enrolled_on`, `prior_level`, `notes_ur`.

**Layout (two-column):**

| Left column | Right column (stacked cards) |
|-------------|------------------------------|
| Student details card: first + last name, full_name_ur (RTLInput), date_of_birth, gender, guardian_name, guardian_phone, guardian_whatsapp, preferred_lang | Card 1 — Course & class: course select → class select (filtered by course); class options show capacity inline; full classes are disabled |
| | Card 2 — Prior knowledge: level select + notes_ur (RTLInput textarea) |
| | Full-width primary submit button |

**Error handling:**
- `ENROLLMENT_CONFLICT` (409) → inline error on class field in English + Urdu
- `CLASS_FULL` (409) → inline error on class field
- Other errors → toast

**Success state:** replaces the form with a centered success panel showing "Enroll another" and "View student profile" actions.

#### `EnrollmentsList.jsx`

- **Filter bar:** class dropdown (loaded from `getClasses(centerId)`) + Active/Withdrawn/All status toggle + name search input.
- **Search:** client-side filter on both `full_name` and `full_name_ur` fields, so Arabic/Urdu name search works without an extra API call.
- **Withdraw action:** opens `WithdrawModal`; on success invalidates `['class-enrollments', classId]`.
- Defaults to the first class in the list; switching the class dropdown re-fetches enrollments.

#### `WithdrawModal.jsx`

Wraps `Modal` (size `sm`). Confirms the student name and class name, accepts a withdrawal date (default today) and an optional Urdu reason (RTLInput textarea). Calls `PATCH /enrollments/:id { status: 'withdrawn', withdrawn_on, notes_ur }`.

### Attendance frontend module

#### `frontend/src/api/attendance.js` — full export list

| Export | HTTP | Description |
|--------|------|-------------|
| `createAttendanceSession(classId, payload)` | `POST /classes/:id/attendance` | Bulk-mark session; `{ session_date, records[] }` |
| `getClassAttendance(classId, params)` | `GET /classes/:id/attendance` | `?from`, `?to` date range |
| `getSessionRecords(sessionId)` | `GET /attendance/sessions/:id/records` | Records for a specific session |
| `updateRecord(sessionId, recordId, payload)` | `PATCH /attendance/sessions/:sid/records/:rid` | Correct a single record |
| `getStudentAttendance(userId, params)` | `GET /students/:id/attendance` | `?class_id`, `?from`, `?to`; returns `{ total_sessions, present, absent, late, attendance_pct, records[] }` |

#### `frontend/src/hooks/useAttendance.js` — hook exports

| Hook | Returns | Description |
|------|---------|-------------|
| `useClassAttendance(classId, dateRange)` | `useQuery` result | Attendance sessions for a class in `{ from, to }` range |
| `useStudentAttendance(userId, params)` | `useQuery` result | Student attendance history + summary |
| `useMarkAttendance(classId)` | `useMutation` | `mutateAsync({ session_date, records[] })` — invalidates class attendance cache on success |
| `useCorrectRecord()` | `useMutation` | `mutateAsync({ sessionId, recordId, classId, payload })` — invalidates class attendance cache |

#### `MarkAttendance.jsx` — teacher marking view

1. Class selector + date picker (default today) + "Load class" button.
2. On load: fetches active enrollments + existing session for that date in parallel.
3. If an existing session is found → pre-populates records and shows a gold "Editing existing session" banner.
4. Each student row: name + Urdu name + three toggle buttons (P=emerald, A=red, L=gold). Selecting "A" reveals a Urdu RTLInput note field below.
5. **Live summary header** updates as statuses change (no API call — derived from `records` state).
6. **Sticky bottom bar** (fixed, above sidebar, full width) shows summary + "Save attendance" button. Calls `POST /classes/:id/attendance` with all records.

#### `AttendanceSheet.jsx` — review grid

- **Mode toggle:** Week (7 columns) or Month (N columns = days in month).
- **Date navigation:** ← → arrows shift by 1 week or 1 month.
- **Grid:** rows = enrolled students, columns = dates. Each cell shows a P/A/L chip. Clicking a cell opens an inline 3-button corrector row (P/A/L + cancel) → calls `updateRecord`.
- **Per-student % column** (right): present+late / total visible sessions with data.
- **Per-day % header row**: class attendance % for each day a session exists. Colored green ≥ 75%, red below.
- **CSV export**: client-side; includes BOM (`﻿`) so Urdu names render correctly in Excel. Columns: Student, Urdu Name, one column per date, Attendance %.

#### `MyAttendance.jsx` — student read-only view

- Fetches `GET /students/:id/attendance?from=YYYY-01-01&to=YYYY-12-31` for the current year.
- **4 MetricCards**: Present, Absent, Late, Attendance % (color: green ≥ 75%, gold 50–74%, red <50%).
- **Monthly calendar grid**: 7-column Monday-anchored grid. Days with sessions are colored (green=present, red=absent, gold=late). Hover shows date + status. Month navigation ← → changes the displayed month (year-level data already loaded).
- **Sessions table**: descending date order, columns Date / Status (Badge) / Note (Urdu RTL). Capped at 480px height with scroll.

### Token audit result

All 29 CSS custom properties from `design.html` are present in `tokens.css`. The file `quran-foundation-lms-design.html` does not exist — the four docs files are `design.html`, `api_reference.html`, `database_schema.html`, `wireframes.html`.

### Environment variable

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | Backend base URL |

Set in `frontend/.env`.

### Auth flow

**Token storage strategy:**
- `access_token` lives in a module-level JS variable inside `client.js` — never written to `localStorage` or a cookie.
- `refresh_token` is stored in an httpOnly cookie set by the API server. The client never reads it directly; it is sent automatically on every request via `withCredentials: true`.

**Session restore on app load (`AuthProvider` mount):**
1. Calls `POST /auth/refresh` with no body (httpOnly cookie sent automatically).
2. On success: stores returned `access_token` in memory via `setAccessToken()`, then calls `GET /auth/me` to populate `user` state.
3. On failure (no valid cookie / expired): stays logged out, sets `loading = false`.

**Login:**
1. `login({ phone, password })` calls `POST /auth/login`.
2. Stores `access_token` in memory; sets `user` state from the response `user` object.

**Logout:**
1. `logout()` calls `POST /auth/logout` (sends the httpOnly cookie so the server can revoke it).
2. Clears in-memory `access_token`; nulls `user` state.
3. React Router detects `isAuthenticated = false` and redirects to `/signin`.

**Automatic silent refresh on 401:**
- The axios response interceptor catches 401 responses.
- Attempts `POST /auth/refresh` using a raw `axios` call (bypasses the interceptor to avoid infinite loops).
- Concurrent requests that arrive during the refresh are queued and replayed once the new token is available.
- If the refresh itself fails, dispatches a `auth:logout` DOM event. `AuthProvider` listens for this event and clears state, triggering a redirect.

**`AuthContext` values:**

| Value | Type | Description |
|-------|------|-------------|
| `user` | `object \| null` | Full user profile from `/auth/me` |
| `role` | `string \| null` | `user.roles[0]` — primary role |
| `isAuthenticated` | `boolean` | `!!user` |
| `loading` | `boolean` | `true` until initial silent refresh resolves |
| `login(credentials)` | `async fn` | Calls API, stores token, sets user |
| `logout()` | `async fn` | Calls API, clears token and user |

### Route protection

`ProtectedRoute` is a react-router v6 layout route (renders `<Outlet />`):

```jsx
// All authenticated users
<Route element={<ProtectedRoute />}>
  <Route element={<AppShell />}>
    <Route path="/dashboard" element={<AdminDashboard />} />
    ...
  </Route>
</Route>

// Role-restricted sub-tree
<Route element={<ProtectedRoute roles={['super_admin']} />}>
  <Route path="/centers" element={<Centers />} />
</Route>
```

Behaviour:
- `loading = true` → renders nothing (waits for session restore).
- `!isAuthenticated` → `<Navigate to="/signin" replace />`.
- `roles` provided but `role` not in list → inline 403 view (no redirect).
- Otherwise → `<Outlet />`.

### Routing table

| Path | Component | Guard |
|------|-----------|-------|
| `/` | `RootRedirect` | → `/dashboard` if authed, `/signin` otherwise |
| `/signin` | `SignIn` | `AuthLayout` (redirects authed users away) |
| `/signup` | `SignUp` | `AuthLayout` |
| `/dashboard` | `AdminDashboard` | `ProtectedRoute` (any role) |
| `/admin/centers` | `CentersList` | `ProtectedRoute roles={['super_admin','center_manager']}` — center_manager is redirected to their own center |
| `/admin/centers/:id` | `CenterDetail` | `ProtectedRoute roles={['super_admin','center_manager']}` — center_manager enforced to own center_id |
| `/admin/org` | `OrgSettings` | `ProtectedRoute roles={['super_admin']}` |
| `/admin/courses` | `CoursesList` | `ProtectedRoute` (any authenticated role) |
| `/admin/courses/:id` | `CourseDetail` | `ProtectedRoute` (any authenticated role) |
| `/classes` | `ClassesList` | `ProtectedRoute roles={['center_manager','teacher']}` — center_manager scoped to user.center_id |
| `/classes/:id` | `ClassDetail` | `ProtectedRoute roles={['center_manager','teacher']}` |
| `/enrollment` | `EnrollmentsList` | `ProtectedRoute roles={['center_manager']}` |
| `/enrollment/new` | `EnrollmentForm` | `ProtectedRoute roles={['center_manager']}` |
| `/attendance` | `MarkAttendance` | `ProtectedRoute roles={['center_manager','teacher']}` |
| `/attendance/sheet` | `AttendanceSheet` | `ProtectedRoute roles={['center_manager','teacher']}` |
| `/attendance/my` | `MyAttendance` | `ProtectedRoute roles={['student']}` |
| `/centers` | redirect | → `/admin/centers` (legacy redirect) |
| `/courses` | redirect | → `/admin/courses` (legacy redirect) |
| `/settings` | redirect | → `/admin/org` (legacy redirect) |
| `/teachers`, `/students`, `/reports`, etc. | `Placeholder` | `ProtectedRoute` (any role) |

### Role-based sidebar nav

`AppShell` reads `role` from `useAuth()` and selects from `NAV_CONFIG`:

| Role | Nav sections |
|------|-------------|
| `super_admin` | Overview (Dashboard → `/dashboard`, Centers → `/admin/centers`), Academic (Courses → `/admin/courses`, Teachers, Students), Reports (Reports, Settings → `/admin/org`) |
| `center_manager` | My Center (Dashboard, Classes, Enrollment, Attendance), Admin (Reports) |
| `teacher` | My Classes (Dashboard, Attendance, Log Progress, Assessments) |
| `student` | My Learning (My Progress, Attendance, Schedule, Results) |

### Design tokens (key values)

Colors are defined as CSS variables in `tokens.css`:
- `--emerald` / `--emerald-bright` — primary brand green (`#1a6b52` / `#2aaa84`)
- `--gold` — secondary accent (`#c8922a`)
- `--sand` — page background (`#f7f4ee`)
- `--ink` — sidebar background and primary text (`#1a1a16`)
- Fonts: `--font-display: 'Amiri', serif` (Arabic/Urdu headings), `--font-body: 'DM Sans', sans-serif`
