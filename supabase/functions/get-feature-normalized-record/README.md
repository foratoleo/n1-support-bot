# get-feature-normalized-record Edge Function

Returns a normalized feature record formatted as Markdown plain text for LLM consumption and external integrations.

## Overview

This endpoint combines data from multiple sources into a single comprehensive Markdown document:

- `view_feature_full_detail` - Main feature data with epic context and computed metrics
- `view_feature_tasks` - Tasks linked to the feature
- `view_feature_sprints_detail` - Associated sprints
- `view_feature_attachments_detail` - File attachments
- `feature_meetings` with `meeting_transcripts` - Related meetings
- `feature_documents` with `generated_documents`/`project_documents` - Linked documents

## Usage

### POST Request

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/get-feature-normalized-record' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "featureId": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

### GET Request

```bash
curl 'https://your-project.supabase.co/functions/v1/get-feature-normalized-record?featureId=550e8400-e29b-41d4-a716-446655440000&projectId=123e4567-e89b-12d3-a456-426614174000' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| featureId | UUID | Yes | The feature ID |
| projectId | UUID | Yes | The project ID (for data isolation) |

GET requests accept both camelCase (`featureId`) and snake_case (`feature_id`) query parameters.

## Response

### Success (200)

Returns plain text Markdown with `Content-Type: text/plain; charset=utf-8`.

#### Response Headers

| Header | Description |
|--------|-------------|
| `X-Processing-Time-Ms` | Time taken to process the request |
| `X-Request-Id` | Unique request identifier |

#### Markdown Structure

```markdown
# Feature Title
**[Epic Title]**

| Campo | Valor |
|-------|-------|
| Status | in_progress |
| Prioridade | high |
| Story Points | 13 |
| Horas Estimadas | 40 |
| Posicao | 1 |
| Criado em | 10/01/2025 14:30 por admin@company.com |
| Atualizado em | 25/01/2025 09:15 |

## Descricao
Full feature description text here...

## Valor Entregue
Description of the business value delivered...

## Criterios de Aceite
- [ ] User can login with email/password
- [x] System validates email format
- [ ] Error messages are displayed correctly

## Dependencias
- Feature A must be completed
- API endpoint available

### Tags
frontend, authentication, mvp

### Notas
Additional notes about the feature...

## Tarefas (5)
| Status | Titulo | Tipo | Responsavel | SP |
|--------|--------|------|-------------|----|
| done | Implement login form | feature | John Doe | 3 |
| in_progress | Add validation | feature | Jane Smith | 2 |
| todo | Write unit tests | testing | - | 2 |

## Sprints Associadas (2)
- Sprint 10 (15/01/2025 - 29/01/2025) - active
- Sprint 11 (30/01/2025 - 13/02/2025) - planning

## Reunioes Relacionadas (1)
- 08/01/2025 - Sprint Planning Meeting

## Documentos (2)
- PRD - Login Feature (generated)
- Technical Spec (project)

## Anexos (1)
- wireframe-login.png (245 KB) - John Doe

## Contexto do Epic
**Epic Title**

Epic description text here...

Acceptance Criteria:
- Criterion 1
- Criterion 2
```

### Error Responses

#### 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "featureId is required",
    "retryable": false
  },
  "requestId": "1706677200000-abc123def",
  "timestamp": "2025-01-31T04:00:00.000Z"
}
```

#### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Feature not found or does not belong to the specified project",
    "retryable": false
  },
  "requestId": "1706677200000-abc123def",
  "timestamp": "2025-01-31T04:00:00.000Z"
}
```

#### 405 Method Not Allowed

```json
{
  "success": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Only POST and GET methods are supported",
    "retryable": false
  },
  "requestId": "1706677200000-abc123def",
  "timestamp": "2025-01-31T04:00:00.000Z"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "retryable": true
  },
  "requestId": "1706677200000-abc123def",
  "timestamp": "2025-01-31T04:00:00.000Z"
}
```

## Architecture

```
get-feature-normalized-record/
├── index.ts              # Entry point with HTTP handler
├── types.ts              # TypeScript interfaces
├── database-service.ts   # Database queries (parallel fetching)
├── markdown-formatter.ts # Markdown document generation
└── README.md             # This file
```

### Dependencies

- `../_shared/validation.ts` - UUID validation
- `../_shared/response-formatter.ts` - Error response formatting

### Database Views

| View | Purpose |
|------|---------|
| `view_feature_full_detail` | Main feature data with epic info and computed metrics |
| `view_feature_tasks` | Tasks linked to features with assignee info |
| `view_feature_sprints_detail` | Feature-sprint associations |
| `view_feature_attachments_detail` | Attachments with formatted file size |

## Performance

- All database queries are executed in parallel using `Promise.all`
- Response time typically under 100ms
- No caching (real-time data)

## Related Documentation

- [Feature Normalized Record Specification](../../../docs/feature-normalized-record.md)
- [Task Normalized Record API](../get-task-normalized-record/README.md)
