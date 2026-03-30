# api-projects

Supabase Edge Function for managing projects (project_knowledge_base table).

## Endpoint

```
POST /functions/v1/api-projects
```

## Actions

All requests are POST with an `action` field to specify the operation.

### Create Project

Creates a new project.

**Request:**
```json
{
  "action": "create",
  "name": "My Project",
  "description": "Project description",
  "category": "development",
  "tags": ["react", "typescript"],
  "context_data": {},
  "is_active": true,
  "owner": "uuid",
  "leaders_managers": [],
  "team_member_links": [],
  "git_repository_url": "https://github.com/org/repo",
  "jira_url": "https://company.atlassian.net/browse/PROJ"
}
```

**Required fields:** `name`, `description`

**Optional fields (with defaults):**
- `category`: null
- `tags`: []
- `context_data`: {}
- `is_active`: true
- `owner`: null
- `leaders_managers`: []
- `team_member_links`: []
- `git_repository_url`: null
- `jira_url`: null

**Response (201):**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "My Project",
      "description": "Project description",
      ...
    }
  },
  "requestId": "...",
  "timestamp": "..."
}
```

### Get Project

Retrieves a single project with full statistics.

**Request:**
```json
{
  "action": "get",
  "project_id": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "My Project",
      "description": "...",
      "category": "development",
      "tags": ["react", "typescript"],
      "context_data": {},
      "is_active": true,
      "owner": "uuid",
      "leaders_managers": [],
      "team_member_links": [],
      "git_repository_url": "https://...",
      "jira_url": "https://...",
      "created_at": "...",
      "updated_at": "...",
      "deleted_at": null,
      "stats": {
        "team_member_count": 5,
        "active_sprint": {
          "id": "uuid",
          "name": "Sprint 1",
          "start_date": "2024-01-01",
          "end_date": "2024-01-15"
        },
        "sprint_count": 10,
        "meeting_count": 25,
        "task_counts": {
          "todo": 10,
          "in_progress": 5,
          "done": 20,
          "blocked": 2,
          "testing": 3,
          "in_review": 1
        }
      }
    }
  },
  "requestId": "..."
}
```

### List Projects

Lists projects with filtering, pagination, and sorting.

**Request:**
```json
{
  "action": "list",
  "filters": {
    "is_active": true,
    "category": "development",
    "tags": ["react"]
  },
  "pagination": {
    "page": 1,
    "limit": 50
  },
  "sort": {
    "field": "created_at",
    "order": "desc"
  }
}
```

**Filters:**
- `is_active`: boolean - Filter by active status
- `category`: string - Filter by category
- `tags`: string[] - Filter by tags (uses overlap/contains)

**Sort Fields:**
- `name`
- `created_at` (default)
- `updated_at`

**Sort Orders:**
- `asc`
- `desc` (default)

**Pagination:**
- `page`: integer, minimum 1 (default: 1)
- `limit`: integer, 1-100 (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "Project 1",
        "description": "...",
        "stats": {
          "team_member_count": 5,
          "sprint_count": 10
        }
      }
    ],
    "pagination": {
      "totalCount": 100,
      "currentPage": 1,
      "pageSize": 50,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "is_active": true
    }
  },
  "requestId": "..."
}
```

### Update Project

Updates an existing project.

**Request:**
```json
{
  "action": "update",
  "project_id": "uuid",
  "data": {
    "name": "Updated Name",
    "description": "Updated description",
    "is_active": false,
    "tags": ["new", "tags"]
  }
}
```

**Updatable fields:**
- `name`
- `description`
- `category`
- `tags`
- `context_data`
- `is_active`
- `owner`
- `leaders_managers`
- `team_member_links`
- `git_repository_url`
- `jira_url`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "Updated Name",
      ...
    }
  },
  "requestId": "..."
}
```

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": ["name is required", "description is required"],
    "retryable": false
  },
  "requestId": "...",
  "timestamp": "..."
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "retryable": false
  },
  "requestId": "...",
  "timestamp": "..."
}
```

### Method Not Allowed (405)
```json
{
  "success": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Only POST method is supported",
    "retryable": false
  },
  "requestId": "...",
  "timestamp": "..."
}
```

### Internal Server Error (500)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "...",
    "retryable": true
  },
  "requestId": "...",
  "timestamp": "..."
}
```

## Response Headers

- `X-Processing-Time-Ms`: Processing time in milliseconds
- `Content-Type`: application/json
- CORS headers for cross-origin requests

## Notes

- All queries filter by `deleted_at IS NULL` (soft delete support)
- GET returns full stats (team members, active sprint, sprint count, meeting count, task counts)
- LIST returns basic stats (team member count, sprint count) for performance
- URL fields (`git_repository_url`, `jira_url`) must be valid HTTP/HTTPS URLs if provided
- `leaders_managers` and `team_member_links` are JSONB arrays - structure is validated as arrays but contents are not validated
