# Supabase Edge Functions - API Endpoints Overview

This document provides a comprehensive overview of all REST API endpoints implemented as Supabase Edge Functions for external integrations.

## Table of Contents

- [Architecture](#architecture)
- [Common Patterns](#common-patterns)
- [Available Endpoints](#available-endpoints)
  - [CRUD APIs (Action-Based)](#crud-apis-action-based)
  - [Single-Purpose APIs](#single-purpose-apis)
  - [Documentation API](#documentation-api)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Quick Reference](#quick-reference)

---

## Architecture

### Modular Design

All API endpoints follow a consistent modular architecture with 7-8 files per endpoint:

```
supabase/functions/api-{entity}/
├── index.ts              # Entry point with action routing
├── types.ts              # TypeScript interfaces and enums
├── validation.ts         # Request validation logic
├── database-service.ts   # Database operations with timeout
├── data-mapper.ts        # Request to database mapping
├── request-handler.ts    # Action-specific handlers
├── response-builder.ts   # CORS and response formatting
└── README.md             # Endpoint-specific documentation
```

### Shared Utilities

Located in `_shared/`:

| File | Purpose |
|------|---------|
| `supabase/client.ts` | Singleton Supabase client |
| `validation.ts` | UUID, enum, date, pagination validators |
| `response-formatter.ts` | Success/error response formatting |
| `api-response-builder.ts` | CORS headers and paginated responses |
| `cors.ts` | CORS headers configuration |

---

## Common Patterns

### Action-Based Routing

CRUD APIs use POST method with an `action` field to determine the operation:

```json
{
  "action": "create|get|list|update|delete",
  "project_id": "uuid",
  ...
}
```

### Single-Purpose APIs

Some endpoints are optimized for specific operations without action routing. They accept direct request parameters.

### Data Isolation

All queries filter by `project_id` (except meetings and team-members which optionally filter):
- Ensures project-level data isolation
- Soft delete pattern: `deleted_at IS NULL`

### Query Timeout

All database operations use a 10-second timeout to prevent hanging queries.

### Caching

Single-purpose list endpoints implement in-memory caching:
- Cache TTL: 5 minutes
- Headers: `X-Cache: HIT|MISS`

### Pagination

Standard pagination across all LIST operations:

```json
{
  "pagination": {
    "page": 1,       // 1-indexed, default: 1
    "limit": 50      // max: 100, default: 50
  }
}
```

Response includes:
```json
{
  "pagination": {
    "totalCount": 42,
    "currentPage": 1,
    "pageSize": 50,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

## Available Endpoints

### CRUD APIs (Action-Based)

| Endpoint | Table/View | Actions | Description |
|----------|------------|---------|-------------|
| `api-backlog-items` | `backlog_items` | create, create_batch, get, list, update | Product backlog management |
| `api-tasks` | `dev_tasks` | create, get, list, update | Development task tracking |
| `api-sprints` | `sprints` | create, get, list, update | Sprint planning and velocity |
| `api-meetings` | `meeting_transcripts` | create, get, list, update | Meeting records and transcripts |
| `api-projects` | `project_knowledge_base` | create, get, list, update | Project repository (central entity) |
| `api-features` | `features` / `view_features_list` | create, create_batch, get, list, update, delete | Feature management with computed fields |

### Single-Purpose APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `api-sprint-details` | POST | Get sprint details with optional tasks |
| `api-sprints-list` | POST | Optimized sprint listing with caching |
| `api-task-assign` | POST | Assign/unassign team member to task |
| `api-task-comments` | POST | Create, list, update task comments |
| `api-task-details` | POST | Get detailed task with relations |
| `api-task-status` | POST | Update task status with tracking |
| `api-tasks-list` | POST | Optimized task listing with caching |
| `api-team-members-list` | POST | Team members listing with stats |

### Documentation API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `api-docs` | GET | Serve API documentation files |

---

## CRUD API Details

### api-backlog-items

**Actions**: `create`, `create_batch`, `get`, `list`, `update`

**Filters**: `status[]`, `priority[]`, `tags[]`

**Sort Fields**: `position`, `created_at`, `priority`, `story_points`

**Status Values**: `draft`, `ready`, `in_refinement`, `approved`

**Priority Values**: `low`, `medium`, `high`, `critical`, `urgent`

**Special**: Batch create (up to 100 items), auto-position calculation

---

### api-tasks

**Actions**: `create`, `get`, `list`, `update`

**Filters**: `status[]`, `priority[]`, `task_type[]`, `sprint_id`, `assigned_to`, `parent_task_id`, `tags[]`

**Sort Fields**: `priority`, `created_at`, `story_points`, `updated_at`, `title`

**Relations**: `assignee` (team_members), `sprint` (sprints), `parent_task`, `subtasks_count`

**Enums**:
- **status**: `todo`, `in_progress`, `testing`, `in_review`, `done`, `blocked`, `cancelled`
- **priority**: `low`, `medium`, `high`, `critical`, `urgent`
- **task_type**: `feature`, `bug`, `enhancement`, `technical_debt`, `research`, `documentation`, `testing`, `deployment`, `maintenance`

---

### api-sprints

**Actions**: `create`, `get`, `list`, `update`

**Filters**: `status[]`

**Sort Fields**: `start_date`, `end_date`, `created_at`, `name`

**Relations**: `task_stats` (total_tasks, total_points, points_by_status)

**Status Values**: `planning`, `active`, `completed`, `cancelled`

**Validation**: `end_date >= start_date` (YYYY-MM-DD format)

---

### api-meetings

**Actions**: `create`, `get`, `list`, `update`

**Filters**: `date_from`, `date_to`, `is_public`, `tags[]`, `project_id` (optional)

**Sort Fields**: `meeting_date`, `created_at`, `title`

**Relations**: `generated_documents_count`

**Special**: `project_id` is OPTIONAL (meetings can exist without project)

**Note**: No soft delete (no `deleted_at` column)

---

### api-projects

**Actions**: `create`, `get`, `list`, `update`

**Filters**: `is_active`, `category`, `tags[]`

**Sort Fields**: `created_at`, `name`, `updated_at`

**Relations**: `stats` object containing:
- `team_member_count`
- `sprint_count` (total sprints)
- `meeting_count` (total meetings)
- `active_sprint` (id, name, start_date, end_date)
- `task_counts` (todo, in_progress, done, blocked, testing, in_review, cancelled)

---

### api-features

**Actions**: `create`, `create_batch`, `get`, `list`, `update`, `delete`

**Filters**: `status[]`, `priority[]`, `tags[]`, `backlog_item_id`

**Sort Fields**: `position`, `created_at`, `priority`, `story_points`, `status`

**Status Values**: `draft`, `ready`, `in_progress`, `done`

**Priority Values**: `low`, `medium`, `high`, `critical`, `urgent`

**Computed Fields** (from view):
- `epic_title` - Title of linked backlog item
- `task_count` - Total linked dev_tasks
- `completed_task_count` - Completed dev_tasks
- `linked_documents_count` - Linked documents count
- `linked_sprints_count` - Linked sprints count
- `attachments_count` - Active attachments count

**Special**: Batch create (up to 100 items), soft delete

---

## Single-Purpose API Details

### api-sprint-details

Get detailed sprint information with optional task list.

**Request:**
```json
{
  "projectId": "uuid",
  "sprintId": "uuid",
  "includeTasks": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sprint 1",
    "description": "First sprint",
    "status": "active",
    "startDate": "2024-01-01",
    "endDate": "2024-01-15",
    "stats": {
      "totalTasks": 10,
      "completedTasks": 3,
      "inProgressTasks": 2,
      "testingTasks": 1,
      "inReviewTasks": 1,
      "todoTasks": 2,
      "blockedTasks": 1,
      "totalStoryPoints": 50,
      "completedStoryPoints": 15,
      "progressPercentage": 30
    },
    "tasks": []
  }
}
```

---

### api-sprints-list

Optimized sprint listing with 5-minute cache.

**Request:**
```json
{
  "projectId": "uuid",
  "status": ["active", "planning"],
  "includeStats": true,
  "page": 1,
  "limit": 20
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {...}
  }
}
```

**Headers**: `X-Cache: HIT|MISS`, `X-Processing-Time-Ms`

---

### api-task-assign

Assign or unassign a team member to a task.

**Request:**
```json
{
  "projectId": "uuid",
  "taskId": "uuid",
  "assignedTo": "uuid | null"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Task title",
    "assignedTo": {
      "id": "uuid",
      "name": "John Doe",
      "slug": "john-doe"
    },
    "previousAssignedTo": null,
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Task assigned successfully"
}
```

---

### api-task-comments

CRUD operations for task comments.

**Actions**: `create`, `list`, `update`

**Create Request:**
```json
{
  "action": "create",
  "project_id": "uuid",
  "task_id": "uuid",
  "author_id": "uuid",
  "content": "Comment text",
  "mentioned_members": ["uuid1", "uuid2"]
}
```

**List Request:**
```json
{
  "action": "list",
  "project_id": "uuid",
  "task_id": "uuid",
  "pagination": { "page": 1, "limit": 50 },
  "sort": { "field": "created_at", "order": "desc" }
}
```

**Update Request:**
```json
{
  "action": "update",
  "project_id": "uuid",
  "comment_id": "uuid",
  "author_id": "uuid",
  "data": {
    "content": "Updated comment",
    "mentioned_members": []
  }
}
```

---

### api-task-details

Get detailed task information with all relations.

**Request:**
```json
{
  "projectId": "uuid",
  "taskId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Task title",
    "description": "Task description",
    "status": "in_progress",
    "priority": "high",
    "taskType": "feature",
    "storyPoints": 5,
    "estimatedHours": 8,
    "actualHours": 4,
    "assignedTo": {
      "id": "uuid",
      "name": "John Doe",
      "slug": "john-doe",
      "avatarUrl": "https://..."
    },
    "sprint": {
      "id": "uuid",
      "name": "Sprint 1",
      "status": "active"
    },
    "parentTask": null,
    "subtasks": [
      { "id": "uuid", "title": "Subtask 1", "status": "done" }
    ],
    "tags": ["frontend", "ui"],
    "dependencies": [],
    "aiMetadata": {}
  }
}
```

---

### api-task-status

Update task status with transition tracking.

**Request:**
```json
{
  "projectId": "uuid",
  "taskId": "uuid",
  "status": "done",
  "actualHours": 6
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Task title",
    "previousStatus": "in_progress",
    "currentStatus": "done",
    "actualHours": 6,
    "updatedAt": "2024-01-15T10:30:00Z",
    "sprint": {
      "id": "uuid",
      "name": "Sprint 1"
    }
  },
  "message": "Task status updated from 'in_progress' to 'done'"
}
```

---

### api-tasks-list

Optimized task listing with 5-minute cache.

**Request:**
```json
{
  "projectId": "uuid",
  "status": ["todo", "in_progress"],
  "assignedTo": "uuid",
  "includeDescription": false,
  "page": 1,
  "limit": 50
}
```

**Defaults:**
- `status`: `["todo"]`
- `includeDescription`: `false`
- `page`: `1`
- `limit`: `50`

**Response:**
```json
{
  "success": true,
  "data": [...],
  "metadata": {
    "totalCount": 100,
    "currentPage": 1,
    "pageSize": 50,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "appliedFilters": {
      "status": ["todo", "in_progress"],
      "includeDescription": false
    }
  }
}
```

**Headers**: `X-Cache: HIT|MISS`, `X-Processing-Time-Ms`

---

### get-task-normalized-record

Returns a task as a normalized Markdown document with all related data.

**Methods**: `POST`, `GET`

**Request (POST):**
```json
{
  "taskId": "uuid",
  "projectId": "uuid"
}
```

**Request (GET):**
```
GET /functions/v1/get-task-normalized-record?taskId=uuid&projectId=uuid
```

**Response:** Plain text Markdown document containing:
- Task title with JIRA key (if available)
- Hierarchy path (Epic > Feature)
- Status, priority, type, assignee, dates
- Description and estimates
- Tags, component area, dependencies
- Subtasks, comments, attachments
- JIRA metadata (if synced)
- Epic and Feature context

**Content-Type**: `text/plain; charset=utf-8`

**Headers**: `X-Processing-Time-Ms`, `X-Request-Id`

**Documentation**: [docs/task-normalized-record.md](../../docs/task-normalized-record.md)

---

### get-feature-normalized-record

Returns a feature as a normalized Markdown document with all related data.

**Methods**: `POST`, `GET`

**Request (POST):**
```json
{
  "featureId": "uuid",
  "projectId": "uuid"
}
```

**Request (GET):**
```
GET /functions/v1/get-feature-normalized-record?featureId=uuid&projectId=uuid
```

**Response:** Plain text Markdown document containing:
- Feature title with Epic reference
- Status, priority, story points, estimated hours, position
- Description, delivered value, acceptance criteria
- Dependencies, tags, notes
- Tasks table (status, title, type, assignee, story points)
- Associated sprints, meetings, documents, attachments
- Epic context with acceptance criteria

**Content-Type**: `text/plain; charset=utf-8`

**Headers**: `X-Processing-Time-Ms`, `X-Request-Id`

**Documentation**: [docs/feature-normalized-record.md](../../docs/feature-normalized-record.md)

---

### api-team-members-list

Team members listing with optional task stats.

**Request:**
```json
{
  "projectId": "uuid",
  "status": ["active"],
  "profile": ["developer", "designer"],
  "includeStats": true,
  "page": 1,
  "limit": 50
}
```

**Defaults:**
- `status`: `["active"]`
- `includeStats`: `false`
- `page`: `1`
- `limit`: `50`

**Note**: `projectId` is optional - if omitted, returns all team members.

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "John Doe",
        "slug": "john-doe",
        "email": "john@example.com",
        "profile": "developer",
        "memberType": "internal",
        "status": "active",
        "taskStats": {
          "totalTasks": 15,
          "completedTasks": 8,
          "inProgressTasks": 3,
          "testingTasks": 1,
          "inReviewTasks": 1,
          "todoTasks": 1,
          "blockedTasks": 1
        }
      }
    ],
    "pagination": {...},
    "appliedFilters": {...}
  }
}
```

**Headers**: `X-Cache: HIT|MISS`, `X-Processing-Time-Ms`

---

## Documentation API

### api-docs

Serves API documentation files for LLM consumption.

**Method**: GET

**Usage:**
```
GET /functions/v1/api-docs                    # Index of all documentation
GET /functions/v1/api-docs?file=api-tasks.md  # Specific API documentation
GET /functions/v1/api-docs?file=llms.txt      # LLM-optimized index
```

**Available Files:**
- `llms.txt` - LLM-optimized index
- `llms-full.txt` - Complete documentation
- `api-projects.md`, `api-tasks.md`, `api-sprints.md`, `api-meetings.md`, `api-backlog-items.md`, `api-features.md`
- `create-prd.md`, `create-user-story.md`, `create-meeting-notes.md`, `create-technical-specs.md`, `create-test-cases.md`, `create-unit-tests.md`

**Content-Type**: `text/markdown` or `text/plain`

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "item": { ... }
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 45
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "totalCount": 42,
      "currentPage": 1,
      "pageSize": 50,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "appliedFilters": { ... }
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 35
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": ["field is required", "invalid UUID"],
    "retryable": false
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description | Retryable |
|------|-------------|-------------|-----------|
| `INVALID_INPUT` | 400 | Request validation failed | No |
| `INVALID_JSON` | 400 | Invalid JSON in request body | No |
| `METHOD_NOT_ALLOWED` | 405 | Only POST method supported | No |
| `NOT_FOUND` | 404 | Resource not found | No |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist | No |
| `PERMISSION_DENIED` | 403 | Insufficient permissions | No |
| `DATABASE_ERROR` | 500 | Database operation failed | Yes |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Yes |
| `FOREIGN_KEY_VIOLATION` | 400 | Referenced record doesn't exist | No |
| `UNIQUE_VIOLATION` | 400 | Duplicate record | No |

### Database Error Mapping

| PostgreSQL Code | Error Code |
|-----------------|------------|
| `23503` | FOREIGN_KEY_VIOLATION |
| `42501` | PERMISSION_DENIED |
| `23505` | UNIQUE_VIOLATION |
| `PGRST116` | NOT_FOUND |

---

## Quick Reference

### Base URL

```
https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/
```

### Authentication

```bash
-H 'Authorization: Bearer YOUR_ANON_KEY'
```

### Content Type

```bash
-H 'Content-Type: application/json'
```

### Example: Create Task

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "title": "Implement OAuth2 authentication",
    "description": "Add Google and GitHub login support",
    "priority": "high",
    "task_type": "feature",
    "story_points": 5,
    "tags": ["auth", "security"]
  }'
```

### Example: List with Filters

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "filters": {
      "status": ["todo", "in_progress"],
      "priority": ["high", "critical"]
    },
    "pagination": {
      "page": 1,
      "limit": 50
    },
    "sort": {
      "field": "priority",
      "order": "desc"
    }
  }'
```

### Example: Update Task Status (Single-Purpose API)

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-task-status' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "projectId": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "taskId": "5066633b-b941-42b1-b522-20f6c96dc7b0",
    "status": "done",
    "actualHours": 6
  }'
```

### Example: Get Task with Relations

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-task-details' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "projectId": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "taskId": "5066633b-b941-42b1-b522-20f6c96dc7b0"
  }'
```

---

## Individual Endpoint Documentation

For detailed documentation on each endpoint, see:

### CRUD APIs
- [api-backlog-items/README.md](./api-backlog-items/README.md)
- [api-tasks/README.md](./api-tasks/README.md)
- [api-sprints/README.md](./api-sprints/README.md)
- [api-meetings/README.md](./api-meetings/README.md)
- [api-projects/README.md](./api-projects/README.md)
- [api-features/README.md](./api-features/README.md)

### Single-Purpose APIs
- [api-task-comments/README.md](./api-task-comments/README.md) (if exists)

---

## Security Notes

- All endpoints require valid Supabase authentication
- Consider implementing rate limiting at the infrastructure level for production use
- Data isolation is enforced via `project_id` filtering
- Soft delete pattern preserves data history (except meetings)

---

## Deployment

Deploy all Edge Functions:

```bash
# Deploy individual function
supabase functions deploy api-tasks

# Deploy all CRUD APIs
supabase functions deploy api-tasks
supabase functions deploy api-sprints
supabase functions deploy api-meetings
supabase functions deploy api-projects
supabase functions deploy api-backlog-items
supabase functions deploy api-features

# Deploy single-purpose APIs
supabase functions deploy api-sprint-details
supabase functions deploy api-sprints-list
supabase functions deploy api-task-assign
supabase functions deploy api-task-comments
supabase functions deploy api-task-details
supabase functions deploy api-task-status
supabase functions deploy api-tasks-list
supabase functions deploy api-team-members-list

# Deploy documentation API
supabase functions deploy api-docs
```

Test locally:

```bash
supabase functions serve api-tasks --no-verify-jwt
```
