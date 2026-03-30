# Shared Utilities

Internal shared code used across Edge Functions.

## Directory Structure

```
_shared/
├── api-response-builder.ts    # Standardized response formatting
├── validation.ts              # Common validation utilities
├── response-formatter.ts      # Request ID generation
├── pagination.ts              # Pagination utilities
└── document-generation/       # AI document generation utilities
    ├── types.ts
    └── utils.ts
```

## Response Builder

Standard response functions:

```typescript
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createCorsResponse,
  CORS_HEADERS
} from '../_shared/api-response-builder.ts';

// Success response
return createSuccessResponse(
  { item: data },
  requestId,
  processingTimeMs,
  201  // HTTP status
);

// Error response
return createErrorResponse(
  'NOT_FOUND',
  'Item not found',
  requestId,
  404,
  false  // retryable
);

// Paginated response
return createPaginatedResponse(
  items,
  requestId,
  processingTimeMs,
  {
    totalCount: 100,
    currentPage: 1,
    pageSize: 50,
    appliedFilters: {}
  }
);

// CORS preflight
return createCorsResponse();
```

## Validation Utilities

Common validation functions:

```typescript
import {
  validateUUID,
  validateNonEmptyString,
  validatePositiveInteger,
  validateEnum,
  validateDateString,
  validateUrl
} from '../_shared/validation.ts';

// UUID validation
if (!validateUUID(projectId)) {
  errors.push('project_id must be a valid UUID');
}

// Enum validation
if (!validateEnum(status, ['draft', 'ready', 'done'])) {
  errors.push('status must be one of: draft, ready, done');
}

// Date validation (YYYY-MM-DD)
if (!validateDateString(startDate)) {
  errors.push('start_date must be in YYYY-MM-DD format');
}
```

## Request ID Generation

```typescript
import { generateRequestId } from '../_shared/response-formatter.ts';

const requestId = generateRequestId();
// Output: "1735123456789-abc123def"
```

## Type Definitions

### Pagination Types

```typescript
interface PaginationMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PaginationRequest {
  page?: number;
  limit?: number;
}
```

### Sort Types

```typescript
interface SortRequest {
  field: string;
  order: 'asc' | 'desc';
}
```

### Error Types

```typescript
type ErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_JSON'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'PERMISSION_DENIED'
  | 'FOREIGN_KEY_VIOLATION';
```

## Notes

- All shared code is in `supabase/functions/_shared/`
- Deno runtime with TypeScript
- No external dependencies (standard library only)
- Each Edge Function re-exports from shared modules
