# Common Patterns

Patterns and conventions used across all API endpoints.

## Action-Based Routing

All endpoints use POST method with an `action` field to determine the operation:

```json
{
  "action": "list",
  "project_id": "uuid",
  "filters": {...},
  "pagination": {...}
}
```

### Available Actions

| Action | Description | Response Code |
|--------|-------------|---------------|
| `create` | Create single entity | 201 |
| `create_batch` | Create multiple entities | 201 |
| `get` | Retrieve single entity by ID | 200 |
| `list` | List entities with filters | 200 |
| `update` | Partial update | 200 |
| `delete` | Soft delete | 200 |

## Pagination

Standard pagination parameters:

```json
{
  "pagination": {
    "page": 1,
    "limit": 50
  }
}
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| page | integer | 1 | - | Page number (1-indexed) |
| limit | integer | 50 | 100 | Items per page |

## Filtering

Filter syntax varies by field type:

```json
{
  "filters": {
    "status": ["todo", "in_progress"],
    "priority": ["high", "critical"],
    "is_active": true,
    "tags": ["frontend"],
    "date_from": "2024-01-01",
    "date_to": "2024-12-31"
  }
}
```

### Filter Types

| Type | Example | Description |
|------|---------|-------------|
| Array | `["todo", "in_progress"]` | Match any value in array |
| Boolean | `true` | Exact match |
| String | `"frontend"` | Exact match or contains |
| Date range | `date_from`, `date_to` | Inclusive range filter |
| UUID | `"uuid-value"` | Exact match for foreign keys |

### Array Filters Behavior

- Status/Priority arrays: Match if value is IN the array
- Tags arrays: Match if ANY tag overlaps (PostgreSQL `&&` operator)

## Sorting

Standard sorting parameters:

```json
{
  "sort": {
    "field": "created_at",
    "order": "desc"
  }
}
```

| Parameter | Values | Default |
|-----------|--------|---------|
| field | Varies by endpoint | `created_at` |
| order | `asc`, `desc` | `desc` |

## Soft Delete

All entities support soft delete via `deleted_at` timestamp:

- `deleted_at: null` = active record
- `deleted_at: timestamp` = deleted record
- All LIST queries filter `deleted_at IS NULL` by default
- DELETE action sets `deleted_at` to current timestamp

## Batch Operations

Endpoints supporting batch create:

```json
{
  "action": "create_batch",
  "project_id": "uuid",
  "items": [
    {"title": "Item 1", "priority": "high"},
    {"title": "Item 2", "priority": "medium"}
  ]
}
```

- Maximum 100 items per request
- All items validated before any are created
- Position auto-calculated if not provided
- Returns array of created items with count

## Request ID

Every request includes a unique `requestId` for tracing:

- Format: `timestamp-randomstring`
- Example: `1735123456789-abc123def`
- Included in all responses for debugging
