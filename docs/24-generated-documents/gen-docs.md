---
name: generated-documents
description: generated_documents table, document types, versioning, retrieval patterns
area: 24
maintained_by: generated-docs-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Generated Documents

## Overview

The `generated_documents` table stores all AI-produced content created through the document generation system. Documents are created by Supabase Edge Functions, versioned through the `is_current_version` flag and `version_number` column, and always scoped to a project. Every document links back to the source `meeting_transcript` that triggered its creation and to the `ai_interaction` record that tracks token usage and cost.

This document covers the complete table schema, the full catalog of document types, how versioning works, how documents relate to transcripts, and the recommended retrieval patterns for each use case.

## generated_documents Table

### Column Reference

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `project_id` | uuid | NO | null | FK to `project_knowledge_base.id` -- project isolation anchor |
| `meeting_transcript_id` | uuid | YES | null | FK to `meeting_transcripts.id` -- source transcript |
| `ai_interaction_id` | uuid | NO | null | FK to `ai_interactions.id` -- source AI interaction record |
| `sprint_id` | uuid | YES | null | FK to `sprints.id` -- associated sprint |
| `status` | text | NO | `'draft'` | Workflow status: draft, submitted, approved, rejected |
| `document_type` | text | YES | null | Document type identifier (e.g., `prd`, `user-story`, `meeting-notes`) |
| `document_name` | text | YES | null | Human-readable document display name |
| `content_markdown` | text | NO | null | Generated document content in Markdown format |
| `raw_content` | text | YES | null | Unprocessed content before any transformation |
| `content_format` | text | YES | `'markdown'` | Format of the content field (e.g., `markdown`, `json`) |
| `version_number` | integer | YES | `1` | Incremental version number for this document family |
| `is_current_version` | boolean | YES | `true` | Whether this record is the active version |
| `replaced_by` | uuid | YES | null | FK to `generated_documents.id` -- the document that superseded this one |
| `word_count` | integer | YES | null | Word count of the document content |
| `section_count` | integer | YES | null | Number of sections detected in the document |
| `estimated_reading_time` | integer | YES | null | Estimated reading time in minutes |
| `quality_score` | numeric | YES | null | AI-assessed quality score |
| `quality_issues` | text[] | YES | `'{}'` | List of identified quality issues |
| `validation_results` | jsonb | YES | `'{}'` | Structured document validation results |
| `company_knowledge_ids` | jsonb | YES | `'[]'` | Referenced company knowledge base entry IDs |
| `submitted_by` | uuid | YES | null | User who submitted the document for approval |
| `submitted_for_approval_at` | timestamptz | YES | null | Timestamp of submission |
| `approved_by` | uuid | YES | null | User who approved the document |
| `approved_at` | timestamptz | YES | null | Approval timestamp |
| `approval_notes` | text | YES | null | Notes recorded at approval time |
| `rejected_by` | uuid | YES | null | User who rejected the document |
| `rejected_at` | timestamptz | YES | null | Rejection timestamp |
| `rejection_reason` | text | YES | null | Reason recorded at rejection time |
| `created_by` | text | YES | null | Creator reference (user ID or system identifier) |
| `created_at` | timestamptz | YES | `now()` | Creation timestamp |
| `updated_at` | timestamptz | YES | `now()` | Last modification timestamp |
| `deleted_at` | timestamptz | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional -- source transcript)
- `ai_interaction_id` -> `ai_interactions.id` (N:1, mandatory -- AI tracking)
- `sprint_id` -> `sprints.id` (N:1, optional -- sprint context)
- `replaced_by` -> `generated_documents.id` (self-reference -- version chain)

### Indexes

| Index | Purpose |
|-------|---------|
| Primary key on `id` | Unique row identifier |
| Index on `project_id` | Project-scoped filtering |
| Index on `meeting_transcript_id` | Transcript-linked document lookup |
| Index on `ai_interaction_id` | AI interaction traceability |
| Index on `sprint_id` | Sprint-based document queries |
| Index on `status` | Workflow status filtering |
| Index on `document_type` | Document type filtering |
| Index on `is_current_version` | Current version filtering |
| Index on `deleted_at` | Soft-delete exclusion |
| Composite on `(project_id, document_type)` | Efficient per-type project queries |
| Composite on `(project_id, meeting_transcript_id)` | Efficient transcript-linked queries |

### RLS Policy

Documents are isolated by project_id through the standard project isolation policy, which checks that the authenticated user has a record in `user_project_access` for the target project.

```sql
CREATE POLICY documents_project_isolation ON generated_documents
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

## Document Types

### Primary Document Types (Generated via Edge Functions)

These six types are produced by the document generation Edge Functions:

| Type Key | Display Name | Edge Function | Content Format |
|----------|-------------|---------------|----------------|
| `prd` | Product Requirements Document | `create-prd` | Markdown |
| `user-story` | User Stories | `create-user-story` | Markdown |
| `meeting-notes` | Meeting Notes | `create-meeting-notes` | Markdown |
| `technical-specs` | Technical Specifications | `create-technical-specs` | Markdown |
| `test-cases` | Test Cases | `create-test-cases` | Markdown |
| `unit-tests` | Unit Test Code | `create-unit-tests` | Markdown (code blocks) |

### Extended Document Type Catalog

The system supports a broader catalog of 51 document types organized into four areas. These types are defined as `DocumentTypeKey` in the shared types and used throughout the generation pipeline.

**Generated Documents (10 types):**
`tasks`, `features`, `prd`, `test-cases`, `user-story`, `meeting-notes`, `unit-tests`, `specs`, `accessibility-test-result`, `performance-test-result`

**Planning Documents (24 types):**
`requirements`, `user-guides`, `change-requirements`, `functional-summary`, `roadmap`, `business-context`, `company-goals`, `retrospective`, `okrs`, `executive-business-review`, `project-plan`, `status-report`, `4ls-retrospective`, `5-whys-analysis`, `90-day-plan`, `brainstorming`, `competitive-analysis`, `customer-journey-mapping`, `design-systems`, `marketing-plan`, `persona`, `project-charter`, `project-kickoff`, `risk-assessment-matrix`, `statement-of-work`

**Development Documents (6 types):**
`architecture`, `technical-specs`, `task-notes`, `code-style-guide`, `technical-summary`, `integration-architecture`

**Governance Documents (11 types):**
`compliance`, `processes-workflows`, `resources-tools`, `compliance-legal`, `team-organization`, `technical-standards`, `standard-operating-procedure`, `strategic-plan`

## Versioning

### How Versioning Works

Each document generation request for a given `(project_id, document_type, meeting_transcript_id)` tuple creates a new version. The versioning strategy uses two columns in coordination:

- `is_current_version` (boolean) -- marks which record is the active one. Only one record per document family can have `true` at any time.
- `version_number` (integer) -- provides a human-readable sequential counter within the document family.

When a new document is generated:

1. All existing records matching the same `(project_id, document_type, meeting_transcript_id)` are updated to set `is_current_version = false`.
2. The `version_number` is calculated as `MAX(existing_version_number) + 1` from those records.
3. The new document is inserted with `is_current_version = true` and the calculated `version_number`.
4. If the previous current version exists, its `replaced_by` field is set to point to the new document.

This creates a linear version chain: every historical version remains accessible, the active version is always identifiable via `is_current_version = true`, and the chain is traversable through `replaced_by`.

### Versioning in Code

The `GeneratedDocumentService` in the shared Edge Function infrastructure handles versioning:

```typescript
// From generated-document-service.ts
const versionNumber = await getNextVersionNumber(supabase, {
  projectId: params.project_id,
  documentType: params.document_type,
  meetingTranscriptId: params.meeting_transcript_id,
});

// Mark all existing versions as non-current
await supabase
  .from('generated_documents')
  .update({
    is_current_version: false,
    replaced_by: newDocumentId,
  })
  .eq('project_id', params.project_id)
  .eq('document_type', params.document_type)
  .eq('meeting_transcript_id', params.meeting_transcript_id)
  .eq('is_current_version', true);

// Insert new version as current
await supabase
  .from('generated_documents')
  .insert({
    ...params,
    version_number: versionNumber,
    is_current_version: true,
  });
```

### Accessing Version History

To retrieve all versions of a document family:

```typescript
const { data: versions } = await supabase
  .from('generated_documents')
  .select('id, version_number, is_current_version, created_at, created_by')
  .eq('project_id', projectId)
  .eq('document_type', 'prd')
  .eq('meeting_transcript_id', transcriptId)
  .is('deleted_at', null)
  .order('version_number', { ascending: false });
```

## Transcript Relationships

### Why Transcripts Matter

Every document generation request originates from a `meeting_transcript`. The transcript provides the content that the AI model analyzes. This relationship enables:

- **Traceability** -- knowing which meeting produced which document
- **Context continuity** -- subsequent document generations can reference prior outputs via `previous_response_id`
- **Audit trail** -- linking documents back to their source through `meeting_transcript_id`
- **Conversation chains** -- multi-document sessions maintain continuity through the transcript + AI interaction chain

### Linking Documents to Transcripts

When invoking a document generation Edge Function, pass `meeting_transcript_id` to establish the relationship:

```typescript
import { generateDocumentAPI } from '@/lib/services/document-generation-service';

const result = await generateDocumentAPI(
  'prd',
  transcriptText,              // The content extracted from the transcript
  projectId,                    // Project scope
  transcriptId,                 // Establishes the transcript link
  userId                        // Creator tracking
);
```

The response includes `document_id` which can be stored alongside the transcript reference:

```typescript
if (result.success) {
  // The document is already stored in generated_documents
  // with meeting_transcript_id set to the provided transcriptId
  console.log('Document stored:', result.document_id);
  console.log('AI interaction:', result.ai_interaction_id);
}
```

### Querying Documents by Transcript

To find all documents generated from a specific transcript:

```typescript
const { data: documents } = await supabase
  .from('generated_documents')
  .select('*')
  .eq('meeting_transcript_id', transcriptId)
  .eq('is_current_version', true)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

## Retrieval Patterns

### Pattern 1: By Project (all current documents)

Retrieve all current-version documents within a project. This is the primary pattern for the document list view.

```typescript
const { data: documents } = await supabase
  .from('generated_documents')
  .select('*')
  .eq('project_id', selectedProjectId)
  .eq('is_current_version', true)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

### Pattern 2: By Project and Type (filtered)

Retrieve all current-version documents of a specific type within a project. Use this when displaying a filtered list, such as all PRDs or all User Stories.

```typescript
const { data: prds } = await supabase
  .from('generated_documents')
  .select('*')
  .eq('project_id', selectedProjectId)
  .eq('document_type', 'prd')
  .eq('is_current_version', true)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

### Pattern 3: By Transcript (all documents from one meeting)

Retrieve all current-version documents linked to a specific transcript. Use this on the transcript detail view to show everything generated from a meeting.

```typescript
const { data: documents } = await supabase
  .from('generated_documents')
  .select('id, document_type, document_name, status, is_current_version, version_number, created_at')
  .eq('meeting_transcript_id', transcriptId)
  .eq('is_current_version', true)
  .is('deleted_at', null)
  .order('document_type');
```

### Pattern 4: Single Document by ID

Retrieve a specific document by its ID. Use this when navigating directly to a document's detail view.

```typescript
const { data: document } = await supabase
  .from('generated_documents')
  .select('*')
  .eq('id', documentId)
  .eq('project_id', selectedProjectId)  // Always validate project scope
  .is('deleted_at', null)
  .single();
```

### Pattern 5: With Transcript Join

Retrieve documents with their associated transcript information using the `documents_with_transcripts` view:

```typescript
const { data: documents } = await supabase
  .from('documents_with_transcripts')
  .select('*')
  .eq('project_id', selectedProjectId)
  .eq('is_current_version', true)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

The view returns each document alongside `transcript_title`, `transcript_date`, and `transcript_speakers` from the joined `meeting_transcripts` table.

### Pattern 6: By Status (workflow filtering)

Retrieve documents by their approval workflow status:

```typescript
const { data: pending } = await supabase
  .from('generated_documents')
  .select('*')
  .eq('project_id', selectedProjectId)
  .eq('status', 'submitted')
  .eq('is_current_version', true)
  .is('deleted_at', null)
  .order('submitted_for_approval_at', { ascending: false });
```

### Pattern 7: Using TanStack Query

All retrieval patterns integrate with TanStack Query v5 for caching and synchronization:

```typescript
import { useQuery } from '@tanstack/react-query';

const { data: documents, isLoading } = useQuery({
  queryKey: ['documents', 'current', selectedProjectId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('is_current_version', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProjectId,  // Only run when project is selected
});
```

For transcript-scoped documents:

```typescript
const { data: transcriptDocs } = useQuery({
  queryKey: ['documents', 'transcript', transcriptId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('meeting_transcript_id', transcriptId)
      .eq('is_current_version', true)
      .is('deleted_at', null)
      .order('document_type');

    if (error) throw error;
    return data;
  },
  enabled: !!transcriptId,
});
```

## Document Status Workflow

Documents progress through a workflow defined by the `status` column:

| Status | Description | Next States |
|--------|-------------|-------------|
| `draft` | Initial state after generation | `submitted`, `rejected` |
| `submitted` | Submitted for review/approval | `approved`, `rejected` |
| `approved` | Reviewed and accepted | -- (terminal) |
| `rejected` | Reviewed and rejected | `draft`, `submitted` |

The `submitted_by`, `approved_by`, and `rejected_by` columns track the users who performed these actions, with corresponding timestamps.

## Document Metadata

### Content Metrics

When a document is stored, `GeneratedDocumentService` calculates three content metrics:

- `word_count` -- total words in `content_markdown`
- `section_count` -- number of top-level sections (Markdown headings)
- `estimated_reading_time` -- calculated as `ceil(word_count / 200)` minutes, assuming 200 words per minute reading speed

These metrics are useful for displaying document summaries and estimating review time.

### Quality Assessment

The `quality_score`, `quality_issues`, and `validation_results` columns support document quality workflows. The AI model can be configured to assess output quality, and the results are stored alongside the document for downstream review processes.

## Common Queries Reference

```sql
-- All current documents for a project
SELECT id, document_type, document_name, version_number, status, created_at
FROM generated_documents
WHERE project_id = '...'
  AND is_current_version = true
  AND deleted_at IS NULL
ORDER BY document_type, created_at DESC;

-- Version history for a specific document
SELECT id, version_number, is_current_version, created_at, replaced_by
FROM generated_documents
WHERE project_id = '...'
  AND document_type = 'prd'
  AND meeting_transcript_id = '...'
  AND deleted_at IS NULL
ORDER BY version_number DESC;

-- Documents awaiting approval
SELECT id, document_type, document_name, submitted_by, submitted_for_approval_at
FROM generated_documents
WHERE project_id = '...'
  AND status = 'submitted'
  AND is_current_version = true
  AND deleted_at IS NULL
ORDER BY submitted_for_approval_at ASC;

-- AI cost per document type (via ai_interactions join)
SELECT
  gd.document_type,
  COUNT(*) as generation_count,
  SUM(ai.cost_usd) as total_cost_usd,
  SUM((ai.token_usage->>'total_tokens')::int) as total_tokens
FROM generated_documents gd
JOIN ai_interactions ai ON ai.id = gd.ai_interaction_id
WHERE gd.project_id = '...'
  AND gd.deleted_at IS NULL
  AND ai.deleted_at IS NULL
GROUP BY gd.document_type
ORDER BY total_cost_usd DESC;
```

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Document not found | Wrong `project_id` filter, or document was soft-deleted | Verify `selectedProjectId` is set; check `deleted_at IS NULL` |
| Old version displaying | Cached query returning stale data | Invalidate the TanStack Query cache; add `is_current_version = true` filter |
| Generation succeeded but document missing | `meeting_transcript_id` mismatch in filter | Ensure the same `transcriptId` used for generation is used in retrieval |
| All versions showing instead of current | Missing `is_current_version = true` filter | Always filter by `is_current_version = true` for current-state queries |
| Document count does not match UI | Soft-deleted records excluded | Query includes `deleted_at IS NULL`; deleted documents are hidden |
| Query performance is slow | Missing index on filter columns | Verify composite index on `(project_id, document_type)` exists |

## Related Topics

- [Meeting Transcripts](../23-meeting-transcripts/transcripts.md) -- Source transcripts for document generation
- [Document Generation Edge Functions](../08-document-generation/edge-functions.md) -- Edge Function implementation details, request/response formats
- [Prompt Templates](../09-prompt-templates/templates.md) -- Handlebars template system and document structure definitions
- [AI Interaction Tracking](../10-ai-tracking/tracking.md) -- Token usage, cost tracking, and AI interaction lifecycle
- [Database Schema](../04-database-schema/schema.md) -- Complete table definitions and RLS policies
