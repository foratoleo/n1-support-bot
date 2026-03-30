# api-backlog-items

Supabase Edge Function for backlog items CRUD operations via external API.

## Endpoint

`POST /functions/v1/api-backlog-items`

## Authentication

No authentication required. This endpoint is designed for external integrations.

## Action-Based Routing

All operations use POST with an `action` field to determine the operation:

| Action | Description |
|--------|-------------|
| `create` | Create single backlog item (default if no action) |
| `create_batch` | Create multiple items (default if `items` array present) |
| `get` | Retrieve single item by ID |
| `list` | List items with filters, pagination, sorting |
| `update` | Partial update of an item |

---

## GET Operation

Retrieve a single backlog item by ID.

### Request

```json
{
  "action": "get",
  "project_id": "uuid",
  "item_id": "uuid"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Feature title",
      "description": "Description",
      "acceptance_criteria": [],
      "story_points": 3,
      "priority": "medium",
      "business_value": 7,
      "technical_complexity": 5,
      "tags": ["frontend"],
      "status": "draft",
      "position": 0,
      "converted_task_id": null,
      "created_by": null,
      "created_at": "2025-12-25T00:00:00.000Z",
      "updated_at": "2025-12-25T00:00:00.000Z",
      "deleted_at": null
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### curl Example

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "get",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "item_id": "5066633b-b941-42b1-b522-20f6c96dc7b0"
  }'
```

---

## LIST Operation

List backlog items with optional filters, pagination, and sorting.

### Request

```json
{
  "action": "list",
  "project_id": "uuid",
  "filters": {
    "status": ["draft", "ready"],
    "priority": ["high", "critical"],
    "tags": ["frontend", "auth"]
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

### Filter Options

| Filter | Type | Description |
|--------|------|-------------|
| status | string[] | Filter by status values |
| priority | string[] | Filter by priority values |
| tags | string[] | Filter by tags (matches any) |

### Pagination

| Field | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| page | integer | 1 | - | Page number (1-indexed) |
| limit | integer | 50 | 100 | Items per page |

### Sort Options

| Field | Allowed Values |
|-------|----------------|
| field | position, created_at, priority, story_points |
| order | asc, desc |

### Response (200 OK)

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
    "appliedFilters": {
      "status": ["draft", "ready"]
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### curl Example

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "filters": {
      "status": ["draft"]
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
```

---

## UPDATE Operation

Partial update of a backlog item. Only provided fields are updated.

### Request

```json
{
  "action": "update",
  "project_id": "uuid",
  "item_id": "uuid",
  "data": {
    "title": "Updated title",
    "status": "ready",
    "priority": "high",
    "story_points": 5
  }
}
```

### Updatable Fields

| Field | Type | Description |
|-------|------|-------------|
| title | string | Item title (non-empty) |
| description | string or null | Item description |
| acceptance_criteria | array | List of criteria objects |
| story_points | integer | Estimate (>= 0) |
| priority | string | low, medium, high, critical, urgent |
| business_value | integer or null | Value (1-10 or null) |
| technical_complexity | integer or null | Complexity (1-10 or null) |
| tags | string[] | Array of tags |
| status | string | draft, ready, in_refinement, approved |
| position | integer | Position in backlog |

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "uuid",
      "title": "Updated title",
      "status": "ready",
      "updated_at": "2025-12-25T12:00:00.000Z",
      ...
    }
  },
  "requestId": "1735123456789-abc123def"
}
```

### curl Example

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "item_id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
    "data": {
      "status": "ready",
      "priority": "high",
      "story_points": 8
    }
  }'
```

---

## CREATE Operations

Create operations support backwards compatibility - no `action` field required for single create, and `items` array automatically triggers batch create.

### Single Item Create

```json
{
  "action": "create",
  "project_id": "uuid",
  "title": "Feature title",
  "description": "Optional description",
  "acceptance_criteria": [
    {
      "id": "ac-1",
      "description": "Criterion description",
      "completed": false
    }
  ],
  "story_points": 3,
  "priority": "medium",
  "business_value": 7,
  "technical_complexity": 5,
  "tags": ["frontend", "feature"],
  "status": "draft",
  "position": 0,
  "created_by": "external-system"
}
```

### Batch Create

```json
{
  "action": "create_batch",
  "project_id": "uuid",
  "items": [
    {
      "title": "First item",
      "description": "Description 1"
    },
    {
      "title": "Second item",
      "description": "Description 2"
    }
  ]
}
```

## Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| project_id | uuid | Yes | - | Project identifier |
| title | string | Yes | - | Non-empty title |
| description | string | No | null | Item description |
| acceptance_criteria | array | No | [] | List of acceptance criteria |
| story_points | integer | No | 0 | Estimate (>= 0) |
| priority | string | No | "medium" | low, medium, high, critical, urgent |
| business_value | integer | No | null | Value (1-10 or null) |
| technical_complexity | integer | No | null | Complexity (1-10 or null) |
| tags | string[] | No | [] | Array of tags |
| status | string | No | "draft" | draft, ready, in_refinement, approved |
| position | integer | No | auto | Position in backlog (auto-calculated) |
| created_by | string | No | null | Creator identifier |

## Response Format

### Success (201 Created)

Single item:
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "generated-uuid",
      "project_id": "uuid",
      "title": "Feature title",
      "description": "Description",
      "acceptance_criteria": [],
      "story_points": 0,
      "priority": "medium",
      "business_value": null,
      "technical_complexity": null,
      "tags": [],
      "status": "draft",
      "position": 0,
      "converted_task_id": null,
      "created_by": null,
      "created_at": "2025-12-25T00:00:00.000Z",
      "updated_at": "2025-12-25T00:00:00.000Z",
      "deleted_at": null
    }
  }
}
```

Batch:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "count": 2
  }
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
  "timestamp": "2025-12-25T00:00:00.000Z"
}
```

## HTTP Status Codes

| Code | Operation | Description |
|------|-----------|-------------|
| 200 | get, list, update | Success |
| 201 | create, create_batch | Created successfully |
| 400 | all | Invalid input / Validation failed |
| 404 | all | Project or item not found |
| 405 | all | Method not allowed (only POST) |
| 500 | all | Internal server error |

## Examples

### curl - Single Item

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDcyMTksImV4cCI6MjA3MjkyMzIxOX0.MbvzrRUrtrAU2twA1qIpq46koBsry4cgj9KygwiAOhU' \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "title": "Implementar autenticação OAuth2",
    "description": "Adicionar suporte a login via Google e GitHub",
    "priority": "high",
    "story_points": 5,
    "tags": ["auth", "security"],
    "acceptance_criteria": [
      {"id": "ac1", "description": "Login com Google funcional", "completed": false},
      {"id": "ac2", "description": "Login com GitHub funcional", "completed": false}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
      "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
      "title": "Implementar autenticação OAuth2",
      "description": "Adicionar suporte a login via Google e GitHub",
      "acceptance_criteria": [
        {"id": "ac1", "completed": false, "description": "Login com Google funcional"},
        {"id": "ac2", "completed": false, "description": "Login com GitHub funcional"}
      ],
      "story_points": 5,
      "priority": "high",
      "business_value": null,
      "technical_complexity": null,
      "tags": ["auth", "security"],
      "status": "draft",
      "position": 2,
      "converted_task_id": null,
      "created_by": null,
      "created_at": "2025-12-25T23:38:11.169351+00:00",
      "updated_at": "2025-12-25T23:38:11.169351+00:00",
      "deleted_at": null
    }
  },
  "requestId": "1766705890556-607wjxmv8"
}
```

### curl - Batch Insert

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDcyMTksImV4cCI6MjA3MjkyMzIxOX0.MbvzrRUrtrAU2twA1qIpq46koBsry4cgj9KygwiAOhU' \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "items": [
      {"title": "Criar componente de Dashboard", "priority": "medium", "story_points": 3},
      {"title": "Implementar API de relatórios", "priority": "high", "story_points": 8},
      {"title": "Adicionar testes E2E", "priority": "low", "story_points": 5, "status": "ready"}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "669d035d-a7a6-4321-a920-80af615badf3",
        "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
        "title": "Criar componente de Dashboard",
        "status": "draft",
        "position": 3,
        ...
      },
      {
        "id": "3fb2aadc-b8f4-4f6d-9287-119e7cc20bfa",
        "title": "Implementar API de relatórios",
        "status": "draft",
        "position": 4,
        ...
      },
      {
        "id": "540c969c-9dd8-4c98-a742-7e8142bba49d",
        "title": "Adicionar testes E2E",
        "status": "ready",
        "position": 3,
        ...
      }
    ],
    "count": 3
  },
  "requestId": "1766705934339-qn979r3bz"
}
```

### curl - GET Single Item

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDcyMTksImV4cCI6MjA3MjkyMzIxOX0.MbvzrRUrtrAU2twA1qIpq46koBsry4cgj9KygwiAOhU' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "get",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "item_id": "5066633b-b941-42b1-b522-20f6c96dc7b0"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
      "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
      "title": "Implementar autenticação OAuth2",
      "description": "Adicionar suporte a login via Google e GitHub",
      "acceptance_criteria": [
        {"id": "ac1", "completed": false, "description": "Login com Google funcional"},
        {"id": "ac2", "completed": false, "description": "Login com GitHub funcional"}
      ],
      "story_points": 8,
      "priority": "critical",
      "status": "ready",
      "tags": ["auth", "security"],
      "created_at": "2025-12-25T23:38:11.169351+00:00",
      "updated_at": "2025-12-26T01:37:48.91008+00:00"
    }
  },
  "requestId": "1766713054512-uyu7iahah"
}
```

### curl - LIST with Filters

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDcyMTksImV4cCI6MjA3MjkyMzIxOX0.MbvzrRUrtrAU2twA1qIpq46koBsry4cgj9KygwiAOhU' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "filters": {
      "status": ["ready"],
      "priority": ["high", "critical"]
    },
    "pagination": {
      "page": 1,
      "limit": 10
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
        "title": "Implementar autenticação OAuth2",
        "status": "ready",
        "priority": "critical",
        "story_points": 8
      }
    ],
    "pagination": {
      "totalCount": 1,
      "currentPage": 1,
      "pageSize": 10,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "status": ["ready"],
      "priority": ["high", "critical"]
    }
  },
  "requestId": "1766713077139-ulnln6u1e"
}
```

### curl - LIST All (Paginated)

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDcyMTksImV4cCI6MjA3MjkyMzIxOX0.MbvzrRUrtrAU2twA1qIpq46koBsry4cgj9KygwiAOhU' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "pagination": {
      "page": 1,
      "limit": 5
    },
    "sort": {
      "field": "created_at",
      "order": "desc"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "totalCount": 8,
      "currentPage": 1,
      "pageSize": 5,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "appliedFilters": {}
  },
  "requestId": "1766713035959-299xgy4s4"
}
```

### curl - UPDATE Item

```bash
curl -L -X POST 'https://gerxucfvjluujtpwnybt.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlcnh1Y2Z2amx1dWp0cHdueWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDcyMTksImV4cCI6MjA3MjkyMzIxOX0.MbvzrRUrtrAU2twA1qIpq46koBsry4cgj9KygwiAOhU' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "project_id": "8541d1ae-435a-42b3-bdd0-057c3682ff4a",
    "item_id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
    "data": {
      "status": "ready",
      "priority": "critical",
      "story_points": 8
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "5066633b-b941-42b1-b522-20f6c96dc7b0",
      "title": "Implementar autenticação OAuth2",
      "status": "ready",
      "priority": "critical",
      "story_points": 8,
      "updated_at": "2025-12-26T01:37:48.91008+00:00"
    }
  },
  "requestId": "1766713068789-at2qd7hks"
}
```

### Generic Example (Replace with your project)

```bash
curl -L -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-backlog-items' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "your-project-uuid",
    "title": "Your backlog item title",
    "priority": "medium",
    "story_points": 3
  }'
```

## Validation Rules

- `title`: Cannot be empty or whitespace-only
- `status`: Must be one of: draft, ready, in_refinement, approved
- `priority`: Must be one of: low, medium, high, critical, urgent
- `story_points`: Must be >= 0
- `business_value`: Must be 1-10 or null
- `technical_complexity`: Must be 1-10 or null
- `tags`: Array of non-empty strings
- `project_id`: Must exist in project_knowledge_base table
- `position`: Auto-calculated if not provided (appends to end)

## Limits

- **Batch Size**: Maximum 100 items per request

## Security Notes

This endpoint has no authentication and is designed for external integrations.
Consider implementing rate limiting at the infrastructure level for production use.
