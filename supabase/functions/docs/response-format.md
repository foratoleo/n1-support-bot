# Response Format

All API responses follow a consistent JSON structure for predictable parsing.

## Success Response

```json
{
  "success": true,
  "data": {
    // Response payload varies by endpoint
  },
  "requestId": "1735123456789-abc123def",
  "meta": {
    "processingTimeMs": 45
  }
}
```

## Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": ["field-level errors if applicable"],
    "retryable": true
  },
  "requestId": "1735123456789-abc123def",
  "timestamp": "2025-12-26T00:00:00.000Z"
}
```

## Error Codes

| Code | HTTP Status | Description | Retryable |
|------|-------------|-------------|-----------|
| `INVALID_INPUT` | 400 | Validation failed | No |
| `INVALID_JSON` | 400 | Request body is not valid JSON | No |
| `NOT_FOUND` | 404 | Resource not found | No |
| `METHOD_NOT_ALLOWED` | 405 | Only POST method is supported | No |
| `INTERNAL_ERROR` | 500 | Server error | Yes |
| `DATABASE_ERROR` | 500 | Database operation failed | Yes |
| `PERMISSION_DENIED` | 403 | Insufficient permissions | No |
| `FOREIGN_KEY_VIOLATION` | 400 | Referenced entity does not exist | No |

## HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Successful GET, LIST, UPDATE, DELETE operations |
| 201 | Successful CREATE operations |
| 400 | Invalid request (validation errors, bad JSON) |
| 404 | Resource not found |
| 405 | Wrong HTTP method (must use POST) |
| 500 | Internal server error |

## Response Headers

| Header | Description |
|--------|-------------|
| `X-Processing-Time-Ms` | Request processing time in milliseconds |
| `Content-Type` | Always `application/json` |
| `Access-Control-Allow-Origin` | CORS header for cross-origin requests |

## Pagination Response

LIST operations include pagination metadata:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "totalCount": 100,
      "currentPage": 1,
      "pageSize": 50,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "appliedFilters": {
      "status": ["active"]
    }
  }
}
```

## Notes

- All timestamps are in ISO 8601 format with UTC timezone
- UUIDs are used for all entity identifiers
- Empty arrays `[]` are returned instead of null for list fields
- `deleted_at` field indicates soft-deleted records (null = active)
