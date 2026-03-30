# api-sprints Edge Function

Supabase Edge Function for Sprint CRUD operations.

## Endpoints

All endpoints use POST method with action-based routing.

### Base URL
```
POST /functions/v1/api-sprints
```

## Actions

### Create Sprint

Creates a new sprint.

**Request:**
```json
{
  "action": "create",
  "project_id": "uuid",
  "name": "Sprint 1",
  "description": "First sprint of the project",
  "start_date": "2024-01-15",
  "end_date": "2024-01-29",
  "status": "planning",
  "goals": ["Complete user authentication", "Setup CI/CD"],
  "planned_points": 21,
  "created_by": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "sprint": {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Sprint 1",
      "description": "First sprint of the project",
      "start_date": "2024-01-15",
      "end_date": "2024-01-29",
      "status": "planning",
      "goals": ["Complete user authentication", "Setup CI/CD"],
      "planned_points": 21,
      "completed_points": 0,
      "velocity": null,
      "created_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "deleted_at": null
    }
  },
  "requestId": "req_xxx"
}
```

### Get Sprint

Retrieves a single sprint with task statistics.

**Request:**
```json
{
  "action": "get",
  "project_id": "uuid",
  "sprint_id": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sprint": {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Sprint 1",
      "description": "First sprint",
      "start_date": "2024-01-15",
      "end_date": "2024-01-29",
      "status": "active",
      "goals": ["Complete user authentication"],
      "planned_points": 21,
      "completed_points": 8,
      "velocity": null,
      "created_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-20T10:00:00Z",
      "deleted_at": null,
      "task_stats": {
        "total_tasks": 5,
        "total_points": 21,
        "points_by_status": {
          "todo": 5,
          "in_progress": 8,
          "done": 8
        }
      }
    }
  },
  "requestId": "req_xxx"
}
```

### List Sprints

Lists sprints with optional filters and pagination.

**Request:**
```json
{
  "action": "list",
  "project_id": "uuid",
  "filters": {
    "status": ["planning", "active"]
  },
  "pagination": {
    "page": 1,
    "limit": 10
  },
  "sort": {
    "field": "start_date",
    "order": "desc"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sprints": [
      {
        "id": "uuid",
        "name": "Sprint 2",
        "status": "active",
        "task_stats": {
          "total_tasks": 8,
          "total_points": 34,
          "points_by_status": {}
        }
      }
    ],
    "pagination": {
      "totalCount": 5,
      "currentPage": 1,
      "pageSize": 10,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "status": ["planning", "active"]
    }
  },
  "requestId": "req_xxx"
}
```

### Update Sprint

Updates an existing sprint.

**Request:**
```json
{
  "action": "update",
  "project_id": "uuid",
  "sprint_id": "uuid",
  "data": {
    "name": "Sprint 1 - Extended",
    "end_date": "2024-02-05",
    "status": "active",
    "completed_points": 13
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sprint": {
      "id": "uuid",
      "name": "Sprint 1 - Extended",
      "status": "active",
      "completed_points": 13,
      "updated_at": "2024-01-25T10:00:00Z"
    }
  },
  "requestId": "req_xxx"
}
```

## Field Validations

### Required Fields (Create)
- `project_id`: Valid UUID
- `name`: Non-empty string
- `start_date`: YYYY-MM-DD format
- `end_date`: YYYY-MM-DD format, must be >= start_date

### Optional Fields (Create)
- `description`: String or null
- `status`: One of `planning`, `active`, `completed`, `cancelled` (default: `planning`)
- `goals`: Array of non-empty strings (default: `[]`)
- `planned_points`: Non-negative integer (default: `0`)
- `completed_points`: Non-negative integer (default: `0`)
- `velocity`: Non-negative number
- `created_by`: Valid UUID

### Sort Fields
- `start_date` (default)
- `end_date`
- `created_at`
- `name`

### Sort Orders
- `asc`
- `desc` (default)

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": [
      "name is required",
      "end_date must be greater than or equal to start_date"
    ],
    "retryable": false
  },
  "requestId": "req_xxx"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint not found",
    "retryable": false
  },
  "requestId": "req_xxx"
}
```

### Internal Error (500)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "retryable": true
  },
  "requestId": "req_xxx"
}
```

## cURL Examples

### Create Sprint
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/api-sprints' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Sprint 1",
    "start_date": "2024-01-15",
    "end_date": "2024-01-29"
  }'
```

### Get Sprint
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/api-sprints' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "get",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "sprint_id": "987fcdeb-51a2-3bc4-d567-890123456789"
  }'
```

### List Sprints
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/api-sprints' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "filters": {
      "status": ["active"]
    },
    "pagination": {
      "page": 1,
      "limit": 10
    }
  }'
```

### Update Sprint
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/api-sprints' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "sprint_id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "data": {
      "status": "completed",
      "completed_points": 21,
      "velocity": 21
    }
  }'
```

## Notes

- All queries filter by `project_id` for data isolation
- Soft delete is used (`deleted_at IS NULL` filter applied)
- Task statistics are calculated from `dev_tasks` table where `sprint_id` matches
- Responses include `X-Processing-Time-Ms` header for performance monitoring
