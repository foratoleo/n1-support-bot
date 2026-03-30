# api-tasks

Supabase Edge Function for dev_tasks CRUD operations via external API.

## Endpoint

`POST /functions/v1/api-tasks`

## Authentication

No authentication required. This endpoint is designed for external integrations.

## Action-Based Routing

All operations use POST with an `action` field to determine the operation:

| Action | Description |
|--------|-------------|
| `create` | Create single task (default if no action) |
| `get` | Retrieve single task by ID with relations |
| `list` | List tasks with filters, pagination, sorting |
| `update` | Partial update of a task |

---

## GET Operation

Retrieve a single task by ID with related data (assignee, sprint, parent_task, subtasks_count).

### Request

```json
{
  "action": "get",
  "project_id": "uuid",
  "task_id": "uuid"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Implement feature X",
      "description": "Feature description",
      "status": "todo",
      "priority": "medium",
      "task_type": "feature",
      "story_points": 5,
      "estimated_hours": 8,
      "actual_hours": 0,
      "component_area": "frontend",
      "tags": ["react", "ui"],
      "dependencies": [],
      "ai_metadata": {},
      "parent_task_id": null,
      "assigned_to": "uuid",
      "sprint_id": "uuid",
      "feature_id": "uuid",
      "assignee": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar_url": null,
        "slug": "john-doe"
      },
      "sprint": {
        "id": "uuid",
        "name": "Sprint 1",
        "status": "active"
      },
      "parent_task": null,
      "feature": {
        "id": "uuid",
        "title": "Feature name"
      },
      "subtasks_count": 3,
      "created_at": "2025-12-26T00:00:00.000Z",
      "updated_at": "2025-12-26T00:00:00.000Z",
      "deleted_at": null
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### curl Example

```bash
curl -L -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "get",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "task_id": "5066633b-b941-42b1-b522-20f6c96dc7b0"
  }'
```

---

## LIST Operation

List tasks with optional filters, pagination, and sorting.

### Request

```json
{
  "action": "list",
  "project_id": "uuid",
  "filters": {
    "status": ["todo", "in_progress"],
    "priority": ["high", "critical"],
    "task_type": ["feature", "bug"],
    "sprint_id": "uuid",
    "assigned_to": "uuid",
    "assignee_email": "user@example.com",
    "parent_task_id": "uuid",
    "feature_id": "uuid",
    "tags": ["frontend", "urgent"]
  },
  "pagination": {
    "page": 1,
    "limit": 50
  },
  "sort": {
    "field": "priority",
    "order": "desc"
  }
}
```

### Filter Options

| Filter | Type | Description |
|--------|------|-------------|
| status | string[] | Filter by status values |
| priority | string[] | Filter by priority values |
| task_type | string[] | Filter by task type values |
| sprint_id | uuid | Filter by sprint |
| assigned_to | uuid | Filter by assignee ID |
| assignee_email | string | Filter by assignee email (mutually exclusive with assigned_to) |
| parent_task_id | uuid | Filter subtasks by parent |
| feature_id | uuid | Filter by feature |
| tags | string[] | Filter by tags (matches any) |

### Pagination

| Field | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| page | integer | 1 | - | Page number (1-indexed) |
| limit | integer | 50 | 100 | Items per page |

### Sort Options

| Field | Allowed Values |
|-------|----------------|
| field | priority, created_at, story_points, updated_at, title |
| order | asc, desc |

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "pagination": {
      "totalCount": 42,
      "currentPage": 1,
      "pageSize": 50,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "status": ["todo", "in_progress"]
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### Filter by assignee email

Use `assignee_email` to filter tasks by the responsible person's email instead of their UUID. The email is resolved to a `team_members.id` internally. If the email does not match any team member, an empty list is returned with `totalCount: 0`.

`assigned_to` and `assignee_email` are mutually exclusive -- providing both results in a validation error.

### curl Examples

```bash
# Filter by status and priority
curl -L -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "filters": {
      "status": ["todo", "in_progress"],
      "priority": ["high"]
    },
    "pagination": {
      "page": 1,
      "limit": 10
    },
    "sort": {
      "field": "created_at",
      "order": "desc"
    }
  }'

# Filter by assignee email
curl -L -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "filters": {
      "assignee_email": "john@example.com",
      "status": ["todo", "in_progress"]
    }
  }'
```

---

## UPDATE Operation

Partial update of a task. Only provided fields are updated.

### Request

```json
{
  "action": "update",
  "project_id": "uuid",
  "task_id": "uuid",
  "data": {
    "title": "Updated title",
    "status": "in_progress",
    "priority": "high",
    "story_points": 8,
    "assigned_to": "uuid",
    "sprint_id": "uuid",
    "feature_id": "uuid"
  }
}
```

### Updatable Fields

| Field | Type | Description |
|-------|------|-------------|
| title | string | Task title (non-empty) |
| description | string or null | Task description |
| status | string | todo, in_progress, testing, in_review, done, blocked, cancelled |
| priority | string | low, medium, high, critical, urgent |
| task_type | string | feature, bug, enhancement, technical_debt, research, documentation, testing, deployment, maintenance |
| story_points | integer | Story points (>= 0) |
| estimated_hours | integer | Estimated hours (>= 0) |
| actual_hours | integer | Actual hours (>= 0) |
| component_area | string or null | Component area |
| tags | string[] | Array of tags |
| dependencies | array | Array of dependencies |
| ai_metadata | object | AI-generated metadata |
| parent_task_id | uuid or null | Parent task ID |
| assigned_to | uuid or null | Assignee team member ID |
| sprint_id | uuid or null | Sprint ID |
| feature_id | uuid or null | Feature ID |

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid",
      "title": "Updated title",
      "status": "in_progress",
      "updated_at": "2025-12-26T12:00:00.000Z",
      ...
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### curl Example

```bash
curl -L -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "task_id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
    "data": {
      "status": "in_progress",
      "priority": "high",
      "story_points": 8
    }
  }'
```

---

## CREATE Operation

Create a new task.

### Request

```json
{
  "action": "create",
  "project_id": "uuid",
  "title": "New feature task",
  "description": "Optional description",
  "status": "todo",
  "priority": "medium",
  "task_type": "feature",
  "story_points": 5,
  "estimated_hours": 8,
  "component_area": "frontend",
  "tags": ["react", "ui"],
  "assigned_to": "uuid",
  "sprint_id": "uuid",
  "feature_id": "uuid",
  "parent_task_id": "uuid",
  "created_by": "external-system"
}
```

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| project_id | uuid | Yes | - | Project identifier |
| title | string | Yes | - | Non-empty title |
| description | string | No | null | Task description |
| status | string | No | "todo" | todo, in_progress, testing, in_review, done, blocked, cancelled |
| priority | string | No | "medium" | low, medium, high, critical, urgent |
| task_type | string | No | "feature" | feature, bug, enhancement, technical_debt, research, documentation, testing, deployment, maintenance |
| story_points | integer | No | 0 | Story points estimate |
| estimated_hours | integer | No | 0 | Estimated hours |
| actual_hours | integer | No | 0 | Actual hours worked |
| component_area | string | No | null | Component/area of the codebase |
| tags | string[] | No | [] | Array of tags |
| dependencies | array | No | [] | Task dependencies |
| ai_metadata | object | No | {} | AI-generated metadata |
| parent_task_id | uuid | No | null | Parent task for subtasks |
| assigned_to | uuid | No | null | Assignee team member ID |
| sprint_id | uuid | No | null | Sprint ID |
| feature_id | uuid | No | null | Feature ID |
| generated_from_interaction_id | uuid | No | null | AI interaction source |
| created_by | string | No | null | Creator identifier |

## Response Format

### Success (201 Created)

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "generated-uuid",
      "project_id": "uuid",
      "title": "New feature task",
      "status": "todo",
      "priority": "medium",
      "task_type": "feature",
      "story_points": 5,
      "estimated_hours": 8,
      "actual_hours": 0,
      "tags": ["react", "ui"],
      "created_at": "2025-12-26T00:00:00.000Z",
      "updated_at": "2025-12-26T00:00:00.000Z",
      ...
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### Error (400/404/500)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": ["title is required", "project_id must be a valid UUID"],
    "retryable": false
  },
  "requestId": "1735123456789-abc123def",
  "timestamp": "2025-12-26T00:00:00.000Z"
}
```

## HTTP Status Codes

| Code | Operation | Description |
|------|-----------|-------------|
| 200 | get, list, update | Success |
| 201 | create | Created successfully |
| 400 | all | Invalid input / Validation failed |
| 404 | all | Project or task not found |
| 405 | all | Method not allowed (only POST) |
| 500 | all | Internal server error |

## Enum Values

### Status

- `todo` - Not started
- `in_progress` - Currently being worked on
- `testing` - In testing phase
- `in_review` - Under review
- `done` - Completed
- `blocked` - Blocked by external factors
- `cancelled` - Cancelled

### Priority

- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority
- `critical` - Critical priority
- `urgent` - Urgent priority

### Task Type

- `feature` - New feature (default)
- `bug` - Bug fix
- `enhancement` - Enhancement to existing feature
- `technical_debt` - Technical debt remediation
- `research` - Research/investigation
- `documentation` - Documentation task
- `testing` - Testing task
- `deployment` - Deployment task
- `maintenance` - Maintenance task

## Security Notes

This endpoint has no authentication and is designed for external integrations.
Consider implementing rate limiting at the infrastructure level for production use.
