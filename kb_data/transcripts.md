---
name: meeting-transcripts
description: Meeting transcript recording, storage, AI processing pipeline, and document relationships
area: 23
maintained_by: transcript-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Meeting Transcripts

## Overview

Meeting transcripts are recordings of meetings stored in the database. They serve as input for AI document generation.

## meeting_transcripts Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Project association (REQUIRED) |
| title | TEXT | Meeting title |
| content | TEXT | Transcript text content |
| duration_minutes | INTEGER | Meeting duration |
| created_by | UUID | team_members.id |
| created_at | TIMESTAMP | Creation timestamp |

## Recording Flow

1. User starts meeting recording
2. Audio captured and transcribed
3. Transcript saved to `meeting_transcripts.content`
4. User can review/edit transcript
5. Transcript used for document generation

## AI Processing Pipeline

```
Transcript Saved
    |
    v
User selects document type
    |
    v
Call Edge Function (create-prd, etc.)
    |
    v
OpenAI generates document
    |
    v
Document saved to generated_documents
```

## Transcript Query Pattern

```typescript
const { selectedProject } = useProjectSelection();

const { data: transcripts } = useQuery({
  queryKey: ['transcripts', selectedProject?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('project_id', selectedProject?.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProject?.id,
});
```

## Document Generation from Transcript

```typescript
const generateFromTranscript = async (transcriptId: string, docType: string) => {
  const { data: transcript } = await supabase
    .from('meeting_transcripts')
    .select('content')
    .eq('id', transcriptId)
    .single();

  const result = await generateDocumentAPI(
    docType,
    transcript.content,
    selectedProject?.id,
    transcriptId
  );

  return result;
};
```

## Related Topics

- [Generated Documents](../24-generated-documents/gen-docs.md)
- [Document Generation](../08-document-generation/edge-functions.md)
- [AI Tracking](../10-ai-tracking/tracking.md)
