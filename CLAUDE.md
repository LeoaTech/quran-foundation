## Reference documents

- Full API spec: docs/api-reference.html
- Database schema (ERD): docs/database-schema.html
- Design File: docs/design.html

Read all of these before writing any route, migration, or repository. The API
reference defines every endpoint, its request/response shape, and required
roles. The schema defines every table and column including all bilingual
\_ur/\_ar fields. The design file references how the desin of the LMS should
look like

# Quran Foundation LMS — Quran School

## Tech stack

- Node.js + Express (REST API)
- PostgreSQL (UTF-8, uuid PKs via uuid_generate_v4())
- Knex.js (query builder + migrations)
- Redis + Bull (cache + job queue)
- Zod (request validation)
- JWT auth (access 15min, refresh 30 days)
- Docker Compose (all services containerised)

## Architecture rules

- All data scoped to center_id (multi-center NGO)
- RBAC roles: super_admin > center_manager > teacher > student/guardian
- Every route declares required roles via middleware array
- All queries live in /src/repositories/ — never in route handlers
- Service layer in /src/services/ holds all business logic

## Bilingual text

- Every user-facing text column has three variants: name, name_ur, name_ar
- All \_ur and \_ar fields are UTF-8, Urdu/Arabic script
- API reads Accept-Language header (ur/ar/en) to order response fields
- Error responses always include message_ur alongside English message

## Key domain rules

- Soft deletes only: use is_active=false, never DELETE rows
- Progress logging: one session per student per class day
  - Session has classwork (topic + grade + note)
  - Session has one linked homework_entry (1-to-1)
  - Homework scored against homework_criteria defined per class by admin teacher
- Topics (not surahs) — created by admin teachers per course, with optional
  subtopics
- Homework criteria are never hard-deleted, only deactivated (is_active=false)

## Error response shape

{ "error": { "code": "SNAKE_CASE_CODE", "message": "English message",
"message_ur": "اردو پیغام", "field": "field_name", // for validation errors only
"status": 400 } }

## Folder structure

src/ routes/ Express route files controllers/ Thin — just parse req, call
service, send res services/ Business logic repositories/ All Knex DB queries
middleware/ Auth, RBAC, validation jobs/ Bull job definitions workers/ Bull
worker processes utils/ Shared helpers db/ migrations/ Knex migration files
seeds/ Seed data
