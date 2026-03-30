---
name: generated-documents
description: Generated documents table, document types, versioning, and retrieval
area: 24
maintained_by: generated-docs-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Generated Documents

## Overview

Generated documents are AI-created content stored in the `generated_documents` table. Documents are versioned and linked to source transcripts.

## generated_documents Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Project association (REQUIRED) |
| meeting_transcript_id | UUID | Source transcript |
| document_type | TEXT | prd / user_story / meeting_notes / technical_specs / test_cases |
| title | TEXT | Document title |
| content | TEXT | Generated Markdown content |
| is_current_version | BOOLEAN | Version flag |
| created_by | UUID | team_members.id |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

## Document Types

| Type | Description | Edge Function |
|------|-------------|---------------|
| `prd` | Product Requirements Document | create-prd |
| `user_story` | User Stories | create-user-story |
| `meeting_notes` | Meeting Notes | create-meeting-notes |
| `technical_specs` | Technical Specifications | create-technical-specs |
| `test_cases` | Test Cases | create-test-cases |

## Versioning

Only one document of each type per transcript can be current:

```typescript
// When generating new version
await supabase
  .from('generated_documents')
  .update({ is_current_version: false })
  .eq('meeting_transcript_id', transcriptId)
  .eq('document_type', docType);

// Insert new version
await supabase
  .from('generated_documents')
  .insert({
    ...newDoc,
    is_current_version: true,
  });
```

## Query Pattern

```typescript
const { data: documents } = useQuery({
  queryKey: ['documents', selectedProject?.id, transcriptId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('project_id', selectedProject?.id)
      .eq('is_current_version', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
});
```

## Displaying Documents

Documents are Markdown content stored in `content` column:

```typescript
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{document.content}</ReactMarkdown>
```

## Common User Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Document not found | Wrong project selected | Check selectedProject |
| Old version showing | is_current_version stale | Refresh queries |
| Generation failed | API issue or content too long | Retry or shorten transcript |

## Related Topics

- [Meeting Transcripts](../23-meeting-transcripts/transcripts.md)
- [Document Generation](../08-document-generation/edge-functions.md)
- [Prompt Templates](../09-prompt-templates/templates.md)
