---
name: meeting-transcripts
description: meeting_transcripts table, recording process, AI processing, storage
area: 23
maintained_by: transcript-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Meeting Transcripts

## Overview

Meeting transcripts are text recordings of meetings stored in the database. They serve as primary input for AI document generation, enabling the system to transform spoken content into structured documents such as meeting notes, PRDs, user stories, and test cases.

The transcript system maintains a bidirectional relationship with the `meetings` table, allowing transcripts to be linked to scheduled meetings or exist independently as standalone recordings.

## meeting_transcripts Table Schema

The `meeting_transcripts` table stores all transcript data with the following structure:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier for the transcript |
| project_id | UUID | NOT NULL, FK to project_knowledge_base | Project association for data isolation |
| meeting_id | UUID | FK to meetings (ON DELETE SET NULL) | Optional link to scheduled meeting |
| title | TEXT | NOT NULL | Meeting or transcript title |
| description | TEXT | NULL | Optional description or summary |
| transcript_text | TEXT | NULL | Full text content of the transcript |
| meeting_date | TIMESTAMP | NULL | Date and time the meeting occurred |
| duration_minutes | INTEGER | NULL | Duration of the meeting in minutes |
| recorded_by | UUID | FK to team_members | Team member who recorded the transcript |
| tags | TEXT[] | DEFAULT '{}' | Array of tags for categorization |
| is_public | BOOLEAN | DEFAULT false | Visibility flag for sharing |
| created_by | TEXT | NULL | Email of the user who created the record |
| transcript_metadata | JSONB | DEFAULT '{}' | AI-extracted metadata including analysis results |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

### transcript_metadata Structure

The `transcript_metadata` JSONB field stores AI-extracted analysis results with the following structure:

```json
{
  "duration": 3600,
  "word_count": 8500,
  "speakers": ["John", "Sarah", "Mike"],
  "language": "en-US",
  "ai_suggestions": {
    "recommended_documents": ["prd", "user-stories", "meeting-notes"]
  }
}
```

### Key Indexes

- `idx_meeting_transcripts_project_id` - Filter transcripts by project
- `idx_meeting_transcripts_meeting_id` - Link to scheduled meetings
- `idx_meeting_transcripts_created_at` - Sort by creation date
- `idx_meeting_transcripts_tags` - Search by tags (GIN index)

## Recording Process

### Upload Flow

The transcript recording process follows these steps:

1. **Initiation**: User accesses the transcription upload interface through the Planning area
2. **Content Input**: User provides transcript content via one of two methods:
   - **File Upload**: Upload .txt, .md, or .docx files via drag-and-drop
   - **Direct Input**: Paste or type transcript text directly
3. **Metadata Entry**: User fills in metadata:
   - Title (required)
   - Description (optional)
   - Meeting date and time (required)
   - Tags for categorization (optional)
4. **Visibility Selection**: Choose between public (project-wide) or private visibility
5. **AI Processing Option**: Toggle automatic AI notes generation
6. **Submission**: Form validates and saves transcript to database

### Implementation Example

```typescript
// TranscriptionUploadForm.tsx - Upload handler
const handleSubmit = async (values: FormValues) => {
  // Insert transcript into database
  const { data, error: insertError } = await supabase
    .from('meeting_transcripts')
    .insert({
      title: values.title,
      description: values.description,
      meeting_date: format(values.meeting_date, 'yyyy-MM-dd HH:mm:ss'),
      transcript_text: fileContent || values.transcript_text,
      tags: values.tags,
      is_public: values.is_public,
      project_id: selectedProject?.id,
      created_by: user?.email,
      transcript_metadata: {
        upload_method: fileContent ? 'file' : 'text',
        file_name: uploadedFile?.name
      }
    })
    .select()
    .single();

  // Trigger AI notes generation if enabled
  if (values.generate_ai_notes && data) {
    await generateMeetingNotesFromTranscription(
      data.id,
      data.title,
      selectedProject?.id
    );
  }
};
```

### Supported File Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| Plain Text | .txt | text/plain |
| Markdown | .md | text/markdown |
| Word Document | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document |

## AI Processing Pipeline

### Pipeline Overview

The AI processing pipeline transforms raw transcript text into structured, useful documents through two main stages:

```
Transcript Text
     |
     v
analyze-transcript Edge Function
(Extract metadata, tags, recommendations)
     |
     v
User selects document type
     |
     v
Document-specific Edge Function
(create-prd, create-user-story, etc.)
     |
     v
OpenAI API generates document
     |
     v
Document saved to generated_documents table
```

### Stage 1: Transcript Analysis

The `analyze-transcript` Edge Function processes raw transcript text to extract:

- **Title**: Concise, descriptive title (max 100 characters)
- **Description**: Summary description (3-4 sentences)
- **Meeting Date**: ISO format date if mentioned in transcript
- **Tags**: 3-5 relevant topics or categories
- **Recommended Documents**: List of document types suitable for the content
- **Confidence Scores**: Per-field confidence ratings (0.0-1.0)

#### Request Format

```typescript
interface AnalyzeTranscriptRequest {
  content: string;           // Raw transcript text
  project_id?: string;       // Project context
  user_id?: string;         // User tracking
  model?: string;           // Optional model override
  temperature?: number;      // Optional temperature override
  token_limit?: number;     // Optional token limit
}
```

#### Response Format

```typescript
interface TranscriptAnalysis {
  title: string;
  description: string;
  meeting_date: string | null;
  tags: string[];
  recommended_documents: string[];
  confidence_scores: {
    title: number;
    description: number;
    meeting_date: number;
  };
}
```

### Stage 2: Document Generation

After analysis, users can generate various document types from the transcript:

| Document Type | Edge Function | Use Case |
|--------------|---------------|----------|
| Meeting Notes | create-meeting-notes | Structured summary with action items |
| PRD | create-prd | Product requirements and specifications |
| User Stories | create-user-story | User-centric feature descriptions |
| Tasks | create-tasks | Technical implementation tasks |
| Test Cases | create-test-cases | QA testing scenarios |
| Technical Specs | create-technical-specs | Implementation details |
| Unit Tests | create-unit-tests | Automated test coverage |

### Document Generation Flow

```typescript
// RelatedDocuments.tsx - Document generation handler
const handleGenerateDocument = async (documentType: string) => {
  // Fetch transcript data
  const { data: transcript } = await supabase
    .from('meeting_transcripts')
    .select('transcript_text, project_id')
    .eq('id', meetingTranscriptId)
    .single();

  // Call document generation API
  const result = await generateDocumentAPI(
    documentType,           // e.g., 'prd', 'user-stories', 'meeting-notes'
    transcript.transcript_text,
    transcript.project_id,
    meetingTranscriptId,    // Links document back to transcript
    user?.id
  );

  if (result.success) {
    toast.success('Document generated successfully');
  }
};
```

## Relationship to generated_documents

### One-to-Many Relationship

Each meeting transcript can generate multiple documents. The relationship is maintained through the `meeting_transcript_id` foreign key in the `generated_documents` table:

```
meeting_transcripts (1) ----< (N) generated_documents
     |                              |
     +-- id                          +-- meeting_transcript_id
```

### Database Constraint

```sql
ALTER TABLE generated_documents
ADD COLUMN IF NOT EXISTS meeting_transcript_id UUID;

ALTER TABLE generated_documents
ADD CONSTRAINT fk_generated_documents_transcript
FOREIGN KEY (meeting_transcript_id)
REFERENCES meeting_transcripts(id)
ON DELETE SET NULL;
```

### Viewing Related Documents

The `view_meeting_related_documents` database view provides a convenient way to fetch all documents generated from a specific transcript:

```typescript
const fetchRelatedDocuments = async (meetingTranscriptId: string) => {
  const { data, error } = await supabase
    .from('view_meeting_related_documents')
    .select('*')
    .eq('meeting_transcript_id', meetingTranscriptId)
    .order('created_at', { ascending: false });

  return data;
};
```

### Document Grouping by Category

Documents are automatically grouped by category for display:

```typescript
const groupDocumentsByCategory = (documents: MeetingRelatedDocument[]) => {
  return Object.entries(grouped).map(([category, docs]) => ({
    category,
    documents: docs,
    count: docs.length
  }));
};
```

## Storage Architecture

### Supabase Storage Integration

Transcripts are stored directly in PostgreSQL as text content within the `transcript_text` column. This approach provides:

- **ACID Compliance**: Atomic transactions for data integrity
- **Full-Text Search**: Native PostgreSQL text search capabilities
- **Efficient Retrieval**: No network overhead for file downloads
- **Automatic Backups**: Included in Supabase database backups

### RAG Vector Embeddings

Transcript content is also indexed in the `document_embeddings` table for semantic search capabilities:

```typescript
// document_embeddings table structure
{
  id: UUID,
  content_chunk: TEXT,        // Chunked transcript text
  source_table: 'meeting_transcripts',
  source_id: UUID,             // meeting_transcripts.id
  embedding: vector(1536),      // OpenAI text-embedding-ada-002
  project_id: UUID,            // Project scoping
  metadata: JSONB,              // Additional context
  checksum: TEXT,               // Change detection
  token_count: INTEGER,         // Cost tracking
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Indexes for Efficient Storage Queries

```sql
-- Create indexes for document_embeddings
CREATE INDEX idx_document_embeddings_project_source
  ON document_embeddings(project_id, source_table);

CREATE INDEX idx_document_embeddings_vector
  ON document_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Retrieval Patterns

### Using the useMeetingTranscripts Hook

The recommended way to fetch transcripts for a project:

```typescript
// hooks/useMeetingTranscripts.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useMeetingTranscripts(projectId: string | undefined) {
  return useQuery({
    queryKey: ['meetingTranscripts', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('meeting_transcripts')
        .select('id, title, description, meeting_date, tags')
        .eq('project_id', projectId)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}
```

### Using MeetingService

For more complex queries involving meeting-transcript relationships:

```typescript
// MeetingService.ts - fetchMeetingWithTranscript
const fetchMeetingWithTranscript = async (meetingId: string) => {
  const { data, error } = await supabase
    .from('view_meeting_with_transcript')
    .select('*')
    .eq('id', meetingId)
    .maybeSingle();

  if (error) throw error;
  return data;
};
```

### View: view_meeting_with_transcript

This database view combines meetings and transcripts using a LEFT JOIN:

```sql
CREATE VIEW view_meeting_with_transcript AS
  SELECT
    m.*,
    mt.id AS transcript_id,
    mt.transcript_text,
    mt.transcript_metadata,
    mt.tags AS transcript_tags,
    mt.title AS transcript_title,
    mt.description AS transcript_description,
    mt.meeting_date AS transcript_meeting_date
  FROM meetings m
  LEFT JOIN meeting_transcripts mt ON m.id = mt.meeting_id;
```

### Query Pattern: Project-Context Filtering

All queries must filter by `project_id` to enforce data isolation:

```typescript
const fetchTranscriptForProject = async (transcriptId: string, projectId: string) => {
  const { data, error } = await supabase
    .from('meeting_transcripts')
    .select('*')
    .eq('id', transcriptId)
    .eq('project_id', projectId)  // Enforce project isolation
    .single();

  return data;
};
```

## Usage Examples

### Creating a Transcript Programmatically

```typescript
const createTranscript = async (
  title: string,
  transcriptText: string,
  projectId: string,
  meetingDate: Date
) => {
  const { data, error } = await supabase
    .from('meeting_transcripts')
    .insert({
      title,
      transcript_text: transcriptText,
      project_id: projectId,
      meeting_date: format(meetingDate, 'yyyy-MM-dd HH:mm:ss'),
      tags: ['planning', 'discussion'],
      is_public: false
    })
    .select()
    .single();

  return { data, error };
};
```

### Fetching Transcripts with Related Documents

```typescript
const fetchTranscriptWithDocuments = async (transcriptId: string) => {
  // Fetch transcript
  const transcriptPromise = supabase
    .from('meeting_transcripts')
    .select('*')
    .eq('id', transcriptId)
    .single();

  // Fetch related documents
  const documentsPromise = supabase
    .from('view_meeting_related_documents')
    .select('*')
    .eq('meeting_transcript_id', transcriptId);

  const [transcriptResult, documentsResult] = await Promise.all([
    transcriptPromise,
    documentsPromise
  ]);

  return {
    transcript: transcriptResult.data,
    documents: documentsResult.data
  };
};
```

### Generating a Document from Transcript

```typescript
const generateDocument = async (
  transcriptId: string,
  documentType: 'prd' | 'user-stories' | 'meeting-notes',
  projectId: string
) => {
  // Fetch transcript
  const { data: transcript } = await supabase
    .from('meeting_transcripts')
    .select('transcript_text')
    .eq('id', transcriptId)
    .single();

  if (!transcript) {
    throw new Error('Transcript not found');
  }

  // Generate document via Edge Function
  const result = await generateDocumentAPI(
    documentType,
    transcript.transcript_text,
    projectId,
    transcriptId
  );

  return result;
};
```

## Related Documentation

- [Generated Documents](../24-generated-documents/gen-docs.md) - Document storage and retrieval
- [Document Generation Edge Functions](../08-document-generation/edge-functions.md) - AI document creation
- [AI Tracking](../10-ai-tracking/tracking.md) - Token usage and cost management
- [Database Views](../13-database-views/views.md) - view_meeting_with_transcript and related views
- [Project Context System](../06-project-context/context-system.md) - Project isolation patterns
