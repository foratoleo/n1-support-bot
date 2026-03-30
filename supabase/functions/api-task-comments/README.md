# API Task Comments

Supabase Edge Function for managing task comments. Supports creating, listing, and updating comments on development tasks.

## Overview

This endpoint provides CRUD operations for task comments with the following features:
- Author-only editing enforcement
- Mentions support via `mentioned_members`
- Pagination and sorting for list operations
- Full author information in responses

**Note:** DELETE operation is not supported. Comments cannot be deleted through this API.

## Endpoint

```
POST /api-task-comments
```

All operations use POST method with an `action` field to determine the operation type.

## Supported Operations

| Action | Description |
|--------|-------------|
| `create` | Create a new comment on a task |
| `list` | List comments for a specific task |
| `update` | Update an existing comment (author only) |

## Authentication

Requires a valid Supabase auth token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Request/Response Format

### Create Comment

**Request:**
```json
{
  "action": "create",
  "project_id": "uuid",
  "task_id": "uuid",
  "author_id": "uuid",
  "content": "This is my comment",
  "mentioned_members": ["uuid1", "uuid2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "comment": {
      "id": "uuid",
      "task_id": "uuid",
      "project_id": "uuid",
      "author_id": "uuid",
      "content": "This is my comment",
      "mentioned_members": ["uuid1", "uuid2"],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "deleted_at": null
    }
  },
  "metadata": {
    "requestId": "req_xxx",
    "processingTimeMs": 50
  }
}
```

### List Comments

**Request:**
```json
{
  "action": "list",
  "project_id": "uuid",
  "task_id": "uuid",
  "pagination": {
    "page": 1,
    "limit": 20
  },
  "sort": {
    "field": "created_at",
    "order": "desc"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "uuid",
        "task_id": "uuid",
        "project_id": "uuid",
        "author_id": "uuid",
        "content": "Comment content",
        "mentioned_members": [],
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "deleted_at": null,
        "author": {
          "id": "uuid",
          "name": "John Doe",
          "email": "john@example.com",
          "avatar_url": "https://...",
          "headline": "Developer"
        }
      }
    ]
  },
  "metadata": {
    "requestId": "req_xxx",
    "processingTimeMs": 50,
    "pagination": {
      "totalCount": 25,
      "currentPage": 1,
      "pageSize": 20,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "task_id": "uuid"
    }
  }
}
```

### Update Comment

**Request:**
```json
{
  "action": "update",
  "project_id": "uuid",
  "comment_id": "uuid",
  "author_id": "uuid",
  "data": {
    "content": "Updated comment content",
    "mentioned_members": ["uuid1"]
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "comment": {
      "id": "uuid",
      "task_id": "uuid",
      "project_id": "uuid",
      "author_id": "uuid",
      "content": "Updated comment content",
      "mentioned_members": ["uuid1"],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:01Z",
      "deleted_at": null,
      "author": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar_url": null,
        "headline": null
      }
    }
  },
  "metadata": {
    "requestId": "req_xxx",
    "processingTimeMs": 75
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | Request validation failed |
| `INVALID_JSON` | 400 | Invalid JSON in request body |
| `FORBIDDEN` | 403 | Only the author can edit this comment |
| `NOT_FOUND` | 404 | Project, task, or comment not found |
| `METHOD_NOT_ALLOWED` | 405 | Only POST method is supported |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Business Rules

1. **Author-only editing**: Only the original author (matched by `author_id`) can update a comment. Attempting to update someone else's comment returns 403 FORBIDDEN.

2. **No delete operation**: Comments cannot be deleted through this API. This is by design to preserve comment history.

3. **Task validation**: Comments can only be created for existing, non-deleted tasks.

4. **Project scoping**: All operations are scoped to `project_id` for data isolation.

5. **Content validation**: Comment content must be a non-empty string after trimming whitespace.

## Pagination

- Default page: 1
- Default limit: 50
- Maximum limit: 100

## Sort Options

| Field | Description |
|-------|-------------|
| `created_at` | Sort by creation date (default) |
| `updated_at` | Sort by last update date |

Sort order: `asc` or `desc` (default: `desc`)

## Database

- **Table**: `task_comments`
- **View**: `view_task_comments_with_author` (includes author information)
