# api-docs Edge Function

Serves API documentation in markdown format for LLM consumption.

## Endpoint

```
GET /functions/v1/api-docs
GET /functions/v1/api-docs?file=<filename>
```

## Usage

### Get Documentation Index

```bash
curl 'https://<project-ref>.supabase.co/functions/v1/api-docs'
```

Returns markdown index listing all available documentation files.

### Get Specific Documentation

```bash
# Get llms.txt index
curl 'https://<project-ref>.supabase.co/functions/v1/api-docs?file=llms.txt'

# Get full documentation
curl 'https://<project-ref>.supabase.co/functions/v1/api-docs?file=llms-full.txt'

# Get API README
curl 'https://<project-ref>.supabase.co/functions/v1/api-docs?file=api-features.md'

# Get shared docs
curl 'https://<project-ref>.supabase.co/functions/v1/api-docs?file=docs/response-format.md'
```

## Available Files

### Index Files
- `llms.txt` - LLM-optimized documentation index
- `llms-full.txt` - Complete API documentation in single file

### Shared Documentation
- `docs/response-format.md` - Response format and error codes
- `docs/common-patterns.md` - Action routing, pagination, filtering
- `docs/authentication.md` - Authentication requirements
- `docs/_shared.md` - Shared utilities documentation

### API Documentation
- `api-projects.md` - Projects CRUD
- `api-tasks.md` - Tasks CRUD
- `api-sprints.md` - Sprints CRUD
- `api-meetings.md` - Meetings CRUD
- `api-backlog-items.md` - Backlog items CRUD
- `api-features.md` - Features CRUD

### AI Document Generation
- `create-prd.md` - PRD generation
- `create-user-story.md` - User story generation
- `create-meeting-notes.md` - Meeting notes generation
- `create-technical-specs.md` - Technical specs generation
- `create-test-cases.md` - Test cases generation
- `create-unit-tests.md` - Unit tests generation

### Integrations
- `sync-github-prs.md` - GitHub PR sync
- `upload-to-s3.md` - S3 upload
- `upload-to-presigned-s3.md` - Presigned S3 upload
- `generate-presigned-download-url.md` - S3 download URL generation

### Utilities
- `accessibility-test.md` - Accessibility testing
- `service-call-to-markdown.md` - Service call to markdown conversion

## Response Format

### Success (200)

Returns raw markdown/text content with appropriate Content-Type header:
- `.md` files: `text/markdown; charset=utf-8`
- `.txt` files: `text/plain; charset=utf-8`

### Not Found (404)

```json
{
  "error": "File not found",
  "message": "Available files: llms.txt, api-features.md, ...",
  "requested": "invalid-file.md"
}
```

### Method Not Allowed (405)

```json
{
  "error": "Method not allowed. Use GET."
}
```

## LLM Integration

This endpoint is designed for LLM consumption:

1. **llms.txt** - Start here for index and navigation
2. **llms-full.txt** - Full context in single request
3. **Individual .md files** - Detailed documentation per endpoint

### Example LLM Workflow

```
1. Fetch llms.txt to understand API structure
2. Fetch llms-full.txt for complete context
3. Fetch specific .md file for detailed endpoint documentation
```

## Caching

Responses include `Cache-Control: public, max-age=3600` header for 1-hour caching.

## CORS

Full CORS support for browser-based access.
