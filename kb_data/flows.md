---
name: user-flows
description: Key user workflows including registration, login, project selection, and document generation
area: 18
maintained_by: flow-documenter
created: 2026-03-30
updated: 2026-03-30
---

# User Flows

## Overview

Key user workflows in the Workforce application.

## Registration Flow

1. User navigates to `/register`
2. Enters name, email, password
3. System creates Supabase Auth account
4. System creates `team_members` record
5. User redirected to project selection

## Login Flow

1. User navigates to `/login`
2. Enters email, password
3. System validates credentials via Supabase Auth
4. Session created
5. User redirected to dashboard

## Project Selection Flow (CRITICAL)

1. User sees list of projects they belong to
2. User selects a project
3. `selectedProject` context is set
4. ALL subsequent queries filter by this project
5. Project selection persists in localStorage

```typescript
// CORRECT way to use
const { selectedProject } = useProjectSelection();

// selectedProject?.id used in ALL queries
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', selectedProject?.id);
```

## Task Management Flow

1. User navigates to tasks view
2. Tasks displayed filtered by `selectedProject?.id`
3. User can create, edit, delete tasks
4. Task changes reflect immediately via TanStack Query

## Sprint Planning Flow

1. User navigates to sprint view
2. Creates new sprint with start/end dates
3. Assigns tasks to sprint
4. Tracks velocity as tasks complete

## Meeting Recording Flow

1. User navigates to meetings
2. Starts new meeting recording
3. Transcript created in `meeting_transcripts` table
4. Transcript content used for document generation

## Document Generation Flow

1. User selects transcript
2. Chooses document type (PRD, user stories, etc.)
3. Calls Edge Function via `generateDocumentAPI()`
4. Document saved to `generated_documents` table
5. Document displayed to user

```typescript
const result = await generateDocumentAPI(
  'prd',
  transcriptContent,
  selectedProject?.id,
  transcriptId
);

if (result.success) {
  // Document generated and saved
}
```

## Logout Flow

1. User clicks logout
2. `AuthContext.signOut()` called
3. Session cleared
4. Redirect to `/login`

## Related Topics

- [Authentication](../05-authentication/auth-flows.md)
- [Project Context](../06-project-context/context-system.md)
- [Tasks](../21-tasks/tasks.md)
- [Meeting Transcripts](../23-meeting-transcripts/transcripts.md)
