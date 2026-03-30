# api-features Edge Function

CRUD operations for features management with optimized view-based queries.

## Endpoint

```
POST /functions/v1/api-features
```

## Authentication

Requires valid Supabase authentication. Include the `Authorization` header with a valid JWT token.

## Actions Overview

| Action | Description | HTTP Status |
|--------|-------------|-------------|
| `create` | Create a new feature | 201 |
| `create_batch` | Create multiple features at once | 201 |
| `get` | Retrieve a single feature by ID | 200 |
| `list` | List features with filters/pagination | 200 |
| `update` | Partial update of a feature | 200 |
| `delete` | Soft delete a feature | 200 |

## Request Formats

### CREATE

Creates a new feature in the specified project.

**Request:**
```json
{
  "action": "create",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "User Authentication",
  "description": "Implement secure login and registration",
  "status": "draft",
  "priority": "high",
  "story_points": 8,
  "estimated_hours": 40,
  "tags": ["auth", "security"],
  "ready_criteria": [
    {
      "id": "rc-1",
      "description": "Login form validated",
      "completed": false
    }
  ],
  "dependencies": [
    {
      "id": "dep-1",
      "feature_id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Database Setup",
      "type": "blocks"
    }
  ],
  "backlog_item_id": "770e8400-e29b-41d4-a716-446655440002",
  "delivered_value": "Users can securely access the platform",
  "notes": "Consider OAuth integration"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "feature": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "User Authentication",
      "description": "Implement secure login and registration",
      "status": "draft",
      "priority": "high",
      "story_points": 8,
      "estimated_hours": 40,
      "tags": ["auth", "security"],
      "position": 0,
      "epic_title": "Security Epic",
      "task_count": 0,
      "completed_task_count": 0,
      "linked_documents_count": 0,
      "linked_sprints_count": 0,
      "attachments_count": 0,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 45
  }
}
```

### CREATE_BATCH

Creates multiple features in a single operation. Supports backwards compatibility - if `items` array is present without explicit action, batch create is auto-detected.

**Request:**
```json
{
  "action": "create_batch",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "title": "User Authentication",
      "status": "draft",
      "priority": "high",
      "story_points": 8
    },
    {
      "title": "Dashboard Layout",
      "status": "draft",
      "priority": "medium",
      "story_points": 5,
      "tags": ["frontend", "ui"]
    },
    {
      "title": "API Integration",
      "status": "ready",
      "priority": "high",
      "story_points": 13
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "features": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "title": "User Authentication",
        "status": "draft",
        "priority": "high",
        "story_points": 8,
        "position": 0
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440004",
        "title": "Dashboard Layout",
        "status": "draft",
        "priority": "medium",
        "story_points": 5,
        "position": 1
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440005",
        "title": "API Integration",
        "status": "ready",
        "priority": "high",
        "story_points": 13,
        "position": 0
      }
    ],
    "count": 3
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 85
  }
}
```

**Notes:**
- Maximum batch size: 100 items
- Positions are auto-calculated per status group
- All items must pass validation for the batch to succeed
- If any item fails validation, the entire batch is rejected

### GET

Retrieves a single feature by ID with computed fields from the view.

**Request:**
```json
{
  "action": "get",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "feature_id": "880e8400-e29b-41d4-a716-446655440003"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "feature": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "User Authentication",
      "status": "in_progress",
      "priority": "high",
      "task_count": 5,
      "completed_task_count": 2,
      "linked_documents_count": 3,
      "linked_sprints_count": 1,
      "attachments_count": 2
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 25
  }
}
```

### LIST

Lists features with optional filters, pagination, and sorting.

**Request:**
```json
{
  "action": "list",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "filters": {
    "status": ["draft", "ready"],
    "priority": ["high", "critical"],
    "tags": ["frontend"],
    "backlog_item_id": "770e8400-e29b-41d4-a716-446655440002"
  },
  "pagination": {
    "page": 1,
    "limit": 50
  },
  "sort": {
    "field": "position",
    "order": "asc"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "features": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "title": "User Authentication",
        "status": "draft",
        "priority": "high",
        "position": 0,
        "task_count": 5,
        "completed_task_count": 2
      }
    ],
    "pagination": {
      "totalCount": 15,
      "currentPage": 1,
      "pageSize": 50,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "status": ["draft", "ready"],
      "priority": ["high", "critical"]
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 35
  }
}
```

### UPDATE

Partially updates a feature. Only specified fields are modified.

**Request:**
```json
{
  "action": "update",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "feature_id": "880e8400-e29b-41d4-a716-446655440003",
  "data": {
    "status": "in_progress",
    "story_points": 13,
    "notes": "Updated complexity estimate"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "feature": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "status": "in_progress",
      "story_points": 13,
      "notes": "Updated complexity estimate",
      "updated_at": "2024-01-16T14:20:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 30
  }
}
```

### DELETE

Soft deletes a feature by setting `deleted_at` timestamp.

**Request:**
```json
{
  "action": "delete",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "feature_id": "880e8400-e29b-41d4-a716-446655440003"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Feature deleted successfully"
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 20
  }
}
```

## Field Reference

### Feature Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `project_id` | uuid | Yes | - | Project identifier |
| `title` | string | Yes | - | Feature title (non-empty) |
| `description` | string | No | null | Detailed description |
| `backlog_item_id` | uuid | No | null | Link to backlog item (epic) |
| `meeting_transcript_id` | uuid | No | null | Source meeting transcript |
| `status` | enum | No | 'draft' | Feature status |
| `priority` | enum | No | 'medium' | Feature priority |
| `delivered_value` | string | No | null | Business value description |
| `ready_criteria` | jsonb[] | No | [] | Definition of ready criteria |
| `dependencies` | jsonb[] | No | [] | Feature dependencies |
| `notes` | string | No | null | Additional notes |
| `story_points` | integer | No | 0 | Estimated story points (>= 0) |
| `estimated_hours` | integer | No | null | Estimated hours (>= 0) |
| `tags` | string[] | No | [] | Feature tags |
| `position` | integer | No | auto | Display position (>= 0) |
| `created_by` | string | No | null | Creator identifier |

### Status Values

| Value | Description |
|-------|-------------|
| `draft` | Feature is being defined |
| `ready` | Feature is ready for development |
| `in_progress` | Feature is being developed |
| `done` | Feature is completed |

### Priority Values

| Value | Description |
|-------|-------------|
| `low` | Low priority |
| `medium` | Medium priority (default) |
| `high` | High priority |
| `critical` | Critical priority |
| `urgent` | Urgent priority |

### Computed Fields (from view)

| Field | Type | Description |
|-------|------|-------------|
| `epic_title` | string | Title of linked backlog item |
| `task_count` | integer | Total linked dev_tasks |
| `completed_task_count` | integer | Completed dev_tasks |
| `linked_documents_count` | integer | Linked documents count |
| `linked_sprints_count` | integer | Linked sprints count |
| `attachments_count` | integer | Active attachments count |

### Sort Fields

| Field | Description |
|-------|-------------|
| `position` | Display order (default) |
| `created_at` | Creation timestamp |
| `priority` | Priority level |
| `story_points` | Story point estimate |
| `status` | Feature status |

### Sort Orders

| Value | Description |
|-------|-------------|
| `asc` | Ascending order |
| `desc` | Descending order |

### Pagination Defaults

| Parameter | Default | Min | Max |
|-----------|---------|-----|-----|
| `page` | 1 | 1 | - |
| `limit` | 50 | 1 | 100 |

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": [
      "title is required",
      "project_id must be a valid UUID"
    ]
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### Invalid JSON (400)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "Invalid JSON in request body"
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### Method Not Allowed (405)

```json
{
  "success": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Only POST method is supported"
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Feature not found"
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### Server Error (500)

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "retryable": true
  },
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 150
  }
}
```

## cURL Examples

### Create Feature

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/api-features' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "User Authentication",
    "priority": "high",
    "story_points": 8
  }'
```

### List Features with Filters

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/api-features' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "filters": {
      "status": ["draft", "ready"]
    },
    "pagination": {
      "page": 1,
      "limit": 50
    }
  }'
```

### Update Feature Status

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/api-features' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "feature_id": "880e8400-e29b-41d4-a716-446655440003",
    "data": {
      "status": "in_progress"
    }
  }'
```

### Delete Feature

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/api-features' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "delete",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "feature_id": "880e8400-e29b-41d4-a716-446655440003"
  }'
```

### Batch Create Features

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/api-features' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create_batch",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {
        "title": "Feature One",
        "priority": "high"
      },
      {
        "title": "Feature Two",
        "priority": "medium"
      }
    ]
  }'
```

## Database View

This API uses `view_features_list` for optimized read operations, which includes computed aggregations from related tables:
- `dev_tasks` (task counts)
- `feature_documents` (document counts)
- `feature_sprints` (sprint counts)
- `feature_attachments` (attachment counts)
- `backlog_items` (epic title)
