# API Meetings Edge Function

Supabase Edge Function for managing meeting transcripts with CRUD operations.

## Endpoint

```
POST /functions/v1/api-meetings
```

## Actions

All requests use POST method with `action` field to determine operation:

- `create` - Create a new meeting transcript
- `get` - Get a single meeting by ID with generated documents count
- `list` - List meetings with filters and pagination
- `update` - Update meeting fields

## Request/Response Examples

### Create Meeting

Creates a new meeting transcript. `project_id` is optional.

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create",
    "title": "Sprint Planning Meeting",
    "transcript_text": "Full meeting transcript content...",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "description": "Weekly sprint planning session",
    "meeting_date": "2024-01-15T10:00:00Z",
    "tags": ["sprint", "planning"],
    "is_public": false
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Sprint Planning Meeting",
      "description": "Weekly sprint planning session",
      "transcript_text": "Full meeting transcript content...",
      "transcript_metadata": {},
      "meeting_date": "2024-01-15T10:00:00Z",
      "tags": ["sprint", "planning"],
      "is_public": false,
      "created_by": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  },
  "requestId": "req_abc123"
}
```

### Create Meeting Without Project

Meetings can be created without associating to a project:

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create",
    "title": "Team Standup",
    "transcript_text": "Daily standup notes..."
  }'
```

### Get Meeting

Retrieves a single meeting with generated documents count.

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "get",
    "meeting_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Sprint Planning Meeting",
      "description": "Weekly sprint planning session",
      "transcript_text": "Full meeting transcript content...",
      "transcript_metadata": {},
      "meeting_date": "2024-01-15T10:00:00Z",
      "tags": ["sprint", "planning"],
      "is_public": false,
      "created_by": null,
      "created_at": "2024-01-15T10:30:00Z",
      "generated_documents_count": 3
    }
  },
  "requestId": "req_def456"
}
```

### List Meetings

Lists meetings with optional filters, pagination, and sorting.

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "filters": {
      "date_from": "2024-01-01T00:00:00Z",
      "date_to": "2024-01-31T23:59:59Z",
      "is_public": false,
      "tags": ["sprint"]
    },
    "pagination": {
      "page": 1,
      "limit": 20
    },
    "sort": {
      "field": "meeting_date",
      "order": "desc"
    }
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "project_id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Sprint Planning Meeting",
        "description": "Weekly sprint planning session",
        "transcript_text": "Full meeting transcript content...",
        "transcript_metadata": {},
        "meeting_date": "2024-01-15T10:00:00Z",
        "tags": ["sprint", "planning"],
        "is_public": false,
        "created_by": null,
        "created_at": "2024-01-15T10:30:00Z",
        "generated_documents_count": 3
      }
    ],
    "pagination": {
      "totalCount": 5,
      "currentPage": 1,
      "pageSize": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "date_from": "2024-01-01T00:00:00Z",
      "date_to": "2024-01-31T23:59:59Z",
      "is_public": false,
      "tags": ["sprint"]
    }
  },
  "requestId": "req_ghi789"
}
```

### List All Meetings (No Project Filter)

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "list",
    "filters": {
      "is_public": true
    }
  }'
```

### Update Meeting

Updates meeting fields. Only provided fields are updated.

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "meeting_id": "123e4567-e89b-12d3-a456-426614174000",
    "data": {
      "title": "Updated Sprint Planning Meeting",
      "tags": ["sprint", "planning", "q1"],
      "is_public": true
    }
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Updated Sprint Planning Meeting",
      "description": "Weekly sprint planning session",
      "transcript_text": "Full meeting transcript content...",
      "transcript_metadata": {},
      "meeting_date": "2024-01-15T10:00:00Z",
      "tags": ["sprint", "planning", "q1"],
      "is_public": true,
      "created_by": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  },
  "requestId": "req_jkl012"
}
```

### Move Meeting to Different Project

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/api-meetings' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update",
    "meeting_id": "123e4567-e89b-12d3-a456-426614174000",
    "data": {
      "project_id": "660e8400-e29b-41d4-a716-446655440001"
    }
  }'
```

## Field Specifications

### Create Request Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| project_id | UUID | No | null | Project association |
| title | string | Yes | - | Meeting title |
| transcript_text | string | Yes | - | Full transcript content |
| description | string | No | null | Brief description |
| meeting_date | ISO 8601 | No | now() | When meeting occurred |
| transcript_metadata | object | No | {} | Additional metadata |
| tags | string[] | No | [] | Categorization tags |
| is_public | boolean | No | false | Public visibility |
| created_by | string | No | null | Creator identifier |

### List Filters

| Filter | Type | Description |
|--------|------|-------------|
| date_from | ISO 8601 | Filter meetings on or after this date |
| date_to | ISO 8601 | Filter meetings on or before this date |
| is_public | boolean | Filter by public/private status |
| tags | string[] | Filter by tags (overlap match) |
| project_id | UUID | Filter by project |

### Sort Fields

| Field | Description |
|-------|-------------|
| meeting_date | Sort by meeting date (default) |
| created_at | Sort by creation date |
| title | Sort by title alphabetically |

### Sort Orders

| Order | Description |
|-------|-------------|
| desc | Descending (default for meeting_date) |
| asc | Ascending |

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
      "transcript_text is required"
    ],
    "retryable": false
  },
  "requestId": "req_xyz"
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Meeting transcript not found",
    "retryable": false
  },
  "requestId": "req_xyz"
}
```

### Internal Error (500)

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "DATABASE_ERROR: connection failed",
    "retryable": true
  },
  "requestId": "req_xyz"
}
```

## Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token for authentication |
| Content-Type | Yes | Must be `application/json` |

### Response Headers

| Header | Description |
|--------|-------------|
| X-Processing-Time-Ms | Request processing time in milliseconds |
| Content-Type | Always `application/json` |

## Notes

- `project_id` is optional - meetings can exist without project association
- No soft delete - meetings table does not have `deleted_at` column
- `generated_documents_count` is included in GET and LIST responses
- Date filters use ISO 8601 timestamp format
- Tags filter uses PostgreSQL `overlaps` operator (returns meetings with any matching tag)
- Default sort is by `meeting_date` descending (newest first)
- Pagination defaults: page=1, limit=50, max_limit=100
