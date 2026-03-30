---
name: user-flows
description: Step-by-step user flows for all major features
area: 18
maintained_by: flow-documenter
created: 2026-03-30
updated: 2026-03-30
---

# User Flows

This document describes the step-by-step user flows for all major features in the RAG Workforce application. Each flow covers the complete journey from user intent to system response.

---

## Table of Contents

1. [Registration (Sign Up)](#1-registration-sign-up)
2. [Email Verification](#2-email-verification)
3. [Login](#3-login)
4. [Logout](#4-logout)
5. [Project Selection](#5-project-selection)
6. [Task Management - Create Task](#6-task-management---create-task)
7. [Task Management - Assign Task](#7-task-management---assign-task)
8. [Task Management - Change Status](#8-task-management---change-status)
9. [Sprint Planning - Create Sprint](#9-sprint-planning---create-sprint)
10. [Sprint Planning - Assign Tasks to Sprint](#10-sprint-planning---assign-tasks-to-sprint)
11. [Sprint Planning - Track Velocity](#11-sprint-planning---track-velocity)
12. [Meeting Recording - Create Meeting](#12-meeting-recording---create-meeting)
13. [Meeting Recording - View Transcript](#13-meeting-recording---view-transcript)
14. [Document Generation - Select Transcript](#14-document-generation---select-transcript)
15. [Document Generation - Choose Document Type](#15-document-generation---choose-document-type)
16. [Document Generation - Generate via Edge Function](#16-document-generation---generate-via-edge-function)

---

## 1. Registration (Sign Up)

**Objective**: Create a new user account in the system.

**Prerequisites**: None. The registration page is publicly accessible.

**Flow Steps**:

1. User navigates to the application URL.
2. System checks for an active authentication session.
3. If no session exists, system displays the Login page.
4. User clicks the "Sign Up" or "Create Account" link.
5. User enters a valid email address in the email field.
6. User enters a password (minimum 6 characters) in the password field.
7. User confirms the password by entering it again.
8. User clicks the "Create Account" or "Sign Up" button.
9. System validates the input fields:
   - Email format is validated.
   - Password length meets the minimum requirement (6 characters).
10. System calls Supabase Auth `signUp` method with email and password.
11. System creates a new user record in Supabase Auth.
12. System sends a confirmation email to the provided email address.
13. System displays a success message: "Check your email for a confirmation link."
14. User is redirected to the login page or an email verification pending screen.

**Technical Implementation**:
- Uses `signUp` from `useAuth` context in `AuthContext.tsx`.
- Supabase Auth handles user creation and email dispatch.
- The `AuthProvider` wraps the application to manage authentication state.

**Error Handling**:
- If email is already registered: display "Email already registered" error.
- If password is too short: display "Password must be at least 6 characters" error.
- If network error occurs: display generic error with retry option.

---

## 2. Email Verification

**Objective**: Confirm the user's email address to activate the account.

**Prerequisites**: User must have completed registration and received a confirmation email.

**Flow Steps**:

1. User receives an email from the system with a confirmation link.
2. User clicks the confirmation link in the email.
3. System extracts the confirmation token from the URL.
4. System calls Supabase Auth `confirmSignup` with the token.
5. System validates the token:
   - Token is checked for expiration.
   - Token is validated against the user's record.
6. If token is valid, system updates the user's email confirmation status to verified.
7. System redirects the user to the login page.
8. System displays a success message: "Email verified successfully. You can now log in."
9. User proceeds to the login flow.

**Error Handling**:
- If token is expired: display "Confirmation link has expired. Request a new one."
- If token is invalid: display "Invalid confirmation link."
- If email already confirmed: display "Email already verified. Please log in."

---

## 3. Login

**Objective**: Authenticate an existing user and establish a session.

**Prerequisites**: User must have a registered account with a verified email address.

**Flow Steps**:

1. User navigates to the application login page at `/login`.
2. System displays the Login form with email and password fields.
3. User enters their registered email address.
4. User enters their password.
5. (Optional) User checks the "Remember me" checkbox.
6. User clicks the "Log in" button.
7. System validates the input fields:
   - Email format is validated.
   - Password is not empty.
8. System calls Supabase Auth `signIn` method with email and password.
9. System authenticates credentials against Supabase Auth.
10. System creates a new session and stores the session token.
11. System updates the `user` state in `AuthContext`.
12. System clears any previously selected project from localStorage via `ProjectStorage.clearSelectedProject()`.
13. System navigates the user to the `/project-selector` page.
14. User sees the project selection interface.

**Technical Implementation**:
- Component: `LoginForm.tsx` at `src/components/auth/LoginForm.tsx`.
- Uses `signIn` from `useAuth` context in `AuthContext.tsx`.
- Session is managed by Supabase Auth automatically.
- On successful login, `ProjectStorage.clearSelectedProject()` is called.

**Error Handling**:
- If credentials are invalid: display "Invalid email or password."
- If email is not confirmed: display "Please confirm your email address before logging in."
- If too many requests: display "Too many login attempts. Please try again later."
- If network error occurs: display generic error with retry option.

---

## 4. Logout

**Objective**: End the user's session and clear authentication state.

**Prerequisites**: User must be currently logged in.

**Flow Steps**:

1. User clicks the logout button (typically in the header or user menu).
2. System calls Supabase Auth `signOut` method.
3. System clears the user session from storage.
4. System sets the `user` state to `null` in `AuthContext`.
5. System removes any selected project from localStorage.
6. System navigates the user to the `/login` page.
7. User sees the login page and is no longer authenticated.

**Technical Implementation**:
- Uses `signOut` from `useAuth` context in `AuthContext.tsx`.
- `AuthProvider` listens for `SIGNED_OUT` auth events and automatically navigates to `/login`.
- Local project selection data is cleared via `ProjectStorage.clearSelectedProject()`.

**Error Handling**:
- If signOut fails due to network error: display error toast and retry option.
- Session cleanup should still occur locally even if server call fails.

---

## 5. Project Selection

**Objective**: Select a project to work on and establish project context for all subsequent operations.

**Prerequisites**: User must be logged in. User must have access to at least one project.

**Critical Implementation Rule**:
- **ALWAYS** use `selectedProject?.id` from `useProjectSelection()`, **NOT** a separate `selectedProjectId` variable.
- The hook returns the full `selectedProject` object; access the ID via `selectedProject?.id`.

```typescript
// CORRECT
const { selectedProject } = useProjectSelection();
const projectId = selectedProject?.id;

// INCORRECT - this property does not exist
const { selectedProjectId } = useProjectSelection();
```

**Flow Steps**:

1. User logs in and is redirected to `/project-selector`.
2. System displays the project selector page with available projects.
3. System loads user's accessible projects via `useProjects` hook.
4. System displays recent projects at the top of the list with a "Recent" badge.
5. User can search for a project using the search field.
6. User can toggle between grid and list view modes.
7. User clicks on a project card to select it.
8. System calls `selectProject(project)` from `useProjectSelection` hook.
9. System validates that the project exists and has a valid ID.
10. System checks user access rights via `checkUserHasAccess` (unless user is admin).
11. System stores the selected project in `ProjectSelectionContext`.
12. System persists the project to localStorage via `ProjectStorage.setSelectedProject()`.
13. System adds the project to the recent projects history.
14. System navigates the user to `/dashboard` (in project mode) or `/projects/{projectId}`.
15. The selected project is now available via `useProjectSelection().selectedProject`.
16. All subsequent data operations use `selectedProject?.id` to scope queries.

**Technical Implementation**:
- Hook: `useProjectSelection()` from `src/contexts/ProjectSelectionContext.tsx`.
- The hook returns `{ selectedProject, selectProject, projectHistory, ... }`.
- Access the project ID as: `const { selectedProject } = useProjectSelection(); const projectId = selectedProject?.id;`.
- All pages that require a project check `selectedProject` before rendering.
- Protected routes redirect to `/project-selector` if no project is selected.

**Error Handling**:
- If user has no project access: display "You don't have access to this project" and redirect.
- If project ID is invalid: display "Invalid Project" error.
- If project is not selected on a protected route: redirect to `/project-selector`.

---

## 6. Task Management - Create Task

**Objective**: Create a new task within the selected project.

**Prerequisites**: User must be logged in and have a project selected.

**Flow Steps**:

1. User navigates to the Tasks page via the main navigation.
2. System verifies a project is selected; if not, displays an error message.
3. System loads tasks for the current project using `useTasks(selectedProject?.id)`.
4. System displays the task board (Kanban or list view).
5. User clicks the "Add Task" button in the header or task add dropdown.
6. System displays the task creation form dialog (`TaskFormDialog`).
7. User fills in the task details:
   - **Title** (required): Enter a brief task description.
   - **Description** (optional): Enter detailed task information.
   - **Priority** (optional): Select from Low, Medium, High, Critical, Urgent.
   - **Story Points** (optional): Enter an estimated story point value (Fibonacci: 1, 2, 3, 5, 8, 13, 21).
   - **Assignee** (optional): Select a team member to assign the task.
   - **Sprint** (optional): Select a sprint for the task.
   - **Tags** (optional): Add relevant tags.
   - **Acceptance Criteria** (optional): Add acceptance criteria items.
8. User clicks "Save" or "Create" button.
9. System validates the form fields.
10. System calls `taskService.createTask()` with the form data.
11. System includes `project_id: selectedProject.id` and `created_by: user.id` in the payload.
12. System saves the task to the `dev_tasks` database table.
13. System refreshes the task list.
14. System closes the dialog and displays the updated board.
15. System shows a success toast: "Task created successfully."

**Technical Implementation**:
- Page: `Tasks.tsx` at `src/pages/Tasks.tsx`.
- Service: `taskService.createTask()` from `src/lib/services/task-service.ts`.
- Form: `TaskFormDialog` component.
- Project ID: `const { selectedProject } = useProjectSelection(); const projectId = selectedProject?.id;`.

**Alternative Task Creation Methods**:
- **AI Creation**: Click "Create with AI" to generate tasks from natural language via `AITaskCreationDialog`.
- **Voice Creation**: Click "Create by Voice" to use voice input via `VoiceTaskDialog`.
- **From Document**: Click "Create from Document" to generate from existing documents.
- **From File**: Click "Create from File" to generate from uploaded files.

---

## 7. Task Management - Assign Task

**Objective**: Assign a task to a team member.

**Prerequisites**: User must be logged in, have a project selected, and have a task to assign.

**Flow Steps**:

1. User navigates to the Tasks page.
2. User locates the task to assign (via Kanban board or list view).
3. User clicks on the task card to open the task detail modal.
4. System displays the task detail view with current assignee information.
5. User clicks the "Edit" button to modify task details.
6. System displays the assignee selection field.
7. System loads available team members from `useTeamMembers(selectedProject?.id)`.
8. User selects a team member from the dropdown.
9. User clicks "Save" or "Update".
10. System calls `taskService.updateTask()` with the new assignee.
11. System updates the task record in the database.
12. System refreshes the task list.
13. System closes the edit modal and updates the board.
14. System shows a success toast with the assignee name.

**Technical Implementation**:
- Service: `taskService.updateTask(taskId, data)` with `assignee_id` in data payload.
- Hook: `useTeamMembers(selectedProject?.id)` provides the team member list.
- The assignee is stored in the `dev_tasks` table as `assignee_id`.

**Batch Assignment**:
1. User selects multiple tasks in list view using checkboxes.
2. User clicks the batch action bar.
3. User selects "Assign" action.
4. User chooses a team member.
5. System updates all selected tasks with the new assignee.

---

## 8. Task Management - Change Status

**Objective**: Update the status of a task (e.g., move from "To Do" to "In Progress" to "Done").

**Prerequisites**: User must be logged in, have a project selected, and have a task to update.

**Flow Steps - Kanban Drag and Drop**:

1. User navigates to the Tasks page.
2. User views the Kanban board with columns: Todo, In Progress, Done, Blocked.
3. User drags a task card from one column to another.
4. System updates the task status based on the target column.
5. System calls `taskService.updateTask()` with the new status.
6. System updates the task record in the database.
7. System visually animates the card to its new position.
8. System shows a subtle status change indicator.

**Flow Steps - Task Detail Modal**:

1. User clicks on a task card to open the detail modal.
2. User clicks the status dropdown.
3. User selects the new status from the list (Todo, In Progress, Done, Blocked).
4. User clicks "Save".
5. System updates the status and refreshes the board.
6. System closes the modal and shows the updated board.

**Technical Implementation**:
- Kanban board component handles drag-and-drop status changes via `KanbanBoard` component.
- Service: `taskService.updateTask(taskId, { status: 'done' })`.
- Batch status changes supported via `useBatchTaskOperations`.

---

## 9. Sprint Planning - Create Sprint

**Objective**: Create a new sprint within the selected project.

**Prerequisites**: User must be logged in and have a project selected.

**Flow Steps**:

1. User navigates to the Sprints page via the main navigation.
2. System verifies a project is selected; if not, displays an error message.
3. System loads sprints for the current project using `useSprints(selectedProject?.id)`.
4. System displays the sprint list with existing sprints.
5. User clicks the "New Sprint" button.
6. System displays the sprint creation form (`SprintForm`).
7. User fills in the sprint details:
   - **Name** (required): Enter a unique sprint name (e.g., "Sprint 5").
   - **Description** (optional): Enter sprint goals and notes.
   - **Start Date** (required): Select the sprint start date via date picker.
   - **End Date** (required): Select the sprint end date.
   - **Status** (required): Select from Planning, Active, Completed, Cancelled.
   - **Goals** (optional): Add sprint goals as a list of text items.
8. User clicks "Create Sprint" button.
9. System validates the form fields.
10. System ensures the end date is after the start date.
11. System calls the sprint creation function with the form data.
12. System saves the sprint to the `sprints` database table.
13. System navigates to the new sprint's detail page.
14. System shows a success toast: "Sprint created successfully."

**Batch Sprint Creation**:

1. User clicks "Create Batch" button on the Sprints page.
2. System displays the batch creation dialog (`BatchSprintCreationDialog`).
3. User configures multiple sprints at once (e.g., 4 sprints over 8 weeks).
4. System creates all sprints via `useBatchSprintCreation` hook.
5. System displays a progress indicator during creation.
6. System displays a summary of created sprints.

**Technical Implementation**:
- Page: `SprintList.tsx` at `src/pages/SprintList.tsx`.
- Form: `SprintForm.tsx` at `src/pages/sprints/SprintForm.tsx`.
- Data: `useSprints(selectedProject?.id)` hook.
- Form uses `react-hook-form` with `zod` validation schema.
- Sprint status enum: `planning`, `active`, `completed`, `cancelled`.

---

## 10. Sprint Planning - Assign Tasks to Sprint

**Objective**: Associate existing tasks with a specific sprint.

**Prerequisites**: User must be logged in, have a project selected, and have both tasks and a sprint available.

**Flow Steps**:

1. User navigates to the Sprints page.
2. User clicks on a sprint card to open the sprint detail view.
3. System displays the sprint details with associated tasks.
4. User clicks "Add Tasks" or navigates to the Sprint Tasks section.
5. System displays the task selection panel.
6. System loads tasks from the current project that are not yet assigned to a sprint.
7. User selects one or more tasks from the list (checkbox selection).
8. User clicks "Assign to Sprint" button.
9. System calls `taskService.updateTask()` for each selected task with the sprint ID.
10. System updates each task record in the database.
11. System refreshes the sprint detail view.
12. System displays the newly assigned tasks in the sprint task list.
13. System shows a success toast with the count of assigned tasks.

**Technical Implementation**:
- Sprint detail page: `src/pages/sprints/SprintTasks.tsx`.
- Service: `taskService.updateTask(taskId, { sprint_id: sprintId })`.
- Task statistics are recalculated after assignment.

---

## 11. Sprint Planning - Track Velocity

**Objective**: Monitor sprint progress and team velocity through task completion metrics.

**Prerequisites**: User must be logged in, have a project selected, and have at least one active sprint.

**Flow Steps**:

1. User navigates to the Sprints page.
2. System loads sprint task statistics via `taskService.fetchTasks()` for each sprint.
3. System calculates velocity metrics for each sprint:
   - Total tasks count
   - Completed tasks count
   - Total story points
   - Completed story points
   - Velocity percentage (completedPoints / totalPoints * 100)
4. System displays sprint cards with velocity indicators (progress bars, completion stats).
5. User clicks on a sprint card for detailed analytics.
6. System navigates to the Sprint Analytics page (`/sprints/analytics`).
7. System displays:
   - Velocity trend graph
   - Task completion breakdown by status
   - Story points progress bar
   - AI-powered insights via `analyzeSprintAPI()`
8. User can filter analytics by date range or task status.
9. System provides recommendations based on sprint performance.

**Technical Implementation**:
- Analytics page: `src/pages/sprints/SprintAnalyticsPage.tsx`.
- Service: `taskService.fetchTasks()` for sprint-specific task fetching.
- AI analysis: `analyzeSprintAPI(metricsJson, projectId, userId)` from `document-generation-service.ts`.
- Velocity calculation: `completedPoints / totalPoints * 100`.

---

## 12. Meeting Recording - Create Meeting

**Objective**: Create a new meeting record within the selected project.

**Prerequisites**: User must be logged in and have a project selected.

**Flow Steps**:

1. User navigates to the Meetings page via the main navigation.
2. System verifies a project is selected; if not, displays an error message.
3. System loads meetings for the current project.
4. User clicks the "New Meeting" button.
5. System displays the meeting creation form (`MeetingForm`).
6. User fills in the meeting details:
   - **Title** (required): Enter the meeting title.
   - **Description** (optional): Enter meeting description or agenda.
   - **Meeting Date** (required): Select the meeting date.
   - **Start Time** (required): Select the start time.
   - **End Time** (required): Select the end time.
   - **Meeting URL** (optional): Enter a link to the meeting (Zoom, Teams, etc.).
   - **Sprint** (optional): Associate the meeting with a sprint.
   - **Participants** (optional): Add team members or AI agents.
   - **Transcript Agent** (optional): Select an AI agent for transcription.
   - **Recurrence** (optional): Configure recurring meeting settings.
7. User clicks "Create Meeting" button.
8. System validates the form fields.
9. System saves the meeting to the `meetings` database table.
10. System saves participant associations to the `meeting_participants` table.
11. (If calendar sync enabled) System syncs the meeting to Microsoft Outlook calendar.
12. System navigates to the meetings list page.
13. System shows a success toast: "Meeting created successfully."

**Recurring Meeting Flow**:

1. User enables the recurrence option in the meeting form.
2. User configures recurrence pattern (daily, weekly, monthly).
3. User sets the number of occurrences.
4. System displays a confirmation modal showing all meetings to be created.
5. User confirms the recurring creation.
6. System creates all meetings via `useRecurringMeetingCreation` hook.
7. System displays a progress indicator during creation.
8. System shows a summary of created meetings.

**Technical Implementation**:
- Page: `MeetingCreate.tsx` at `src/pages/MeetingCreate.tsx`.
- Component: `MeetingForm` in `src/components/meetings/MeetingForm.tsx`.
- Mutations: `useMeetingMutations` hook.
- Calendar sync: `useCalendarConnection` for Microsoft Outlook integration.
- Recurring meetings: `useRecurringMeetingCreation` hook with confirmation flow.

---

## 13. Meeting Recording - View Transcript

**Objective**: View a meeting's transcript and related information.

**Prerequisites**: User must be logged in, have a project selected, and have a meeting with an associated transcript.

**Flow Steps**:

1. User navigates to the Meetings page.
2. User locates the meeting with a transcript (indicated by a transcript badge or icon).
3. User clicks on the meeting card.
4. System navigates to `/meetings/{meetingId}/detail`.
5. System loads meeting data with transcript via `useMeetingWithTranscript(meetingId)`.
6. System detects the transcript format (plain text or Recall JSON).
7. System displays the meeting hero section with title, status, and badges.
8. System displays the transcript content in the appropriate viewer:
   - Plain text: uses `TranscriptViewer` component.
   - Recall JSON: uses `RecallTranscriptViewer` component.
9. System displays related information in the sidebar:
   - Meeting link card
   - Transcript agent card (if configured)
   - Related documents section
   - Sprint association
   - Participants list
10. User can copy the meeting URL using the copy button.
11. User can edit or delete the meeting (if they are the creator).
12. User can generate documents from the transcript via the Related Documents section.

**Technical Implementation**:
- Page: `MeetingDetailPage.tsx` at `src/pages/meetings/MeetingDetailPage.tsx`.
- Hook: `useMeetingWithTranscript(meetingId)` fetches from `view_meeting_with_transcript` database view.
- Transcript detection: `detectTranscriptFormat()` utility.
- Viewers: `TranscriptViewer` and `RecallTranscriptViewer` components.
- Edit/delete permissions checked against `meeting.created_by === user.id`.

---

## 14. Document Generation - Select Transcript

**Objective**: Select a meeting transcript as the source for document generation.

**Prerequisites**: User must be logged in, have a project selected, and have a meeting with a transcript.

**Flow Steps**:

1. User navigates to the Meetings page.
2. User locates the meeting with a transcript to use.
3. User clicks on the meeting card to view its details.
4. User verifies the transcript content is correct by reviewing it in the viewer.
5. User clicks on the "Related Documents" section in the sidebar.
6. System loads the `RelatedDocuments` component with the transcript ID.
7. System queries the `generated_documents` table for documents linked to this transcript.
8. System displays existing generated documents (if any).
9. User clicks "Generate New Documents" button.
10. System displays the `DocumentGenerator` component.

**Alternative Flow - Direct Document Generation**:

1. User clicks the "Generate Documents" button on the meeting detail page.
2. System displays the `DocumentGenerator` component with the transcript pre-loaded.
3. System loads the transcript from `meeting_transcripts` table via Supabase.
4. System retrieves the project context from the selected project.
5. User proceeds to select document types.

**Technical Implementation**:
- Component: `RelatedDocuments` at `src/components/transcriptions/RelatedDocuments.tsx`.
- Component: `DocumentGenerator` at `src/components/transcriptions/DocumentGenerator.tsx`.
- Data fetch: Supabase query on `meeting_transcripts` table.
- Project context: `selectedProject?.id` from `useProjectSelection()`.

---

## 15. Document Generation - Choose Document Type

**Objective**: Select the types of documents to generate from the transcript.

**Prerequisites**: User must have selected a transcript and opened the document generator.

**Flow Steps**:

1. System displays available document types as selectable cards.
2. User reviews the available document types:
   - **Meeting Notes**: Structured meeting summary with key decisions and action items.
   - **User Stories**: User story generation from discussion points.
   - **Test Cases**: Test scenarios and validation cases.
   - **Technical Specs**: Technical implementation details.
   - **PRD**: Product Requirements Document.
3. User selects one or more document types by clicking the checkboxes on the cards.
4. User optionally adds project context in the "Additional Context" field to enhance generation.
5. User reviews their selections.
6. User clicks the "Generate" button.

**Available Document Types and Edge Functions**:

| Document Type | Edge Function | Description |
|--------------|---------------|-------------|
| Meeting Notes | `create-meeting-notes` | Structured meeting summaries |
| User Stories | `create-user-story` | User story generation |
| Test Cases | `create-test-cases` | Test scenarios |
| Technical Specs | `create-technical-specs` | Implementation details |
| PRD | `create-prd` | Product Requirements Document |
| Unit Tests | `create-unit-tests` | Unit test generation |
| Tasks | `create-tasks` | Task breakdown from content |
| Analyze Transcript | `analyze-transcript` | AI-powered transcript analysis |
| Analyze Sprint | `analyze-sprint` | Sprint metrics analysis |

**Technical Implementation**:
- Component: `DocumentGenerator.tsx` with document type selection UI.
- Centralized types: `useCentralizedDocumentTypes()` hook.
- Selection state managed locally in the component.
- Icons and labels retrieved from centralized document type system.

---

## 16. Document Generation - Generate via Edge Function

**Objective**: Generate selected document types using AI through Supabase Edge Functions.

**Prerequisites**: User must have selected at least one document type and clicked Generate.

**Flow Steps**:

1. System validates that at least one document type is selected.
2. System retrieves the transcript content from `meeting_transcripts` table.
3. System retrieves the project ID from `selectedProject?.id`.
4. System retrieves the user ID from `useAuth()`.
5. System sets the generating state and displays progress UI.
6. System initializes generation steps for each selected document type.
7. For each selected document type (processed sequentially):
   a. System updates the progress step to "in_progress".
   b. System calls `generateDocumentAPI()` with parameters:
      - `documentType`: The document type key (e.g., "user-story", "prd")
      - `transcriptContent`: The meeting transcript text + optional context
      - `projectId`: `selectedProject?.id`
      - `meetingTranscriptId`: The transcript ID for tracking
      - `userId`: `user?.id`
   c. The Edge Function receives the request at `create-{document-type}`.
   d. The Edge Function loads the appropriate Handlebars template.
   e. The Edge Function constructs the OpenAI API prompt using the template.
   f. The Edge Function calls the OpenAI Responses API.
   g. The Edge Function tracks token usage in `ai_interactions` table.
   h. The Edge Function saves the generated document to `generated_documents` table.
   i. The Edge Function returns the response with `success`, `document`, and `response_id`.
   j. System updates the progress step to "completed" or "error".
8. System displays the generation results with status indicators for each document.
9. For successful generations, system provides "View" and "Download" buttons.
10. System triggers the `onComplete` callback to refresh the documents list.
11. System displays a summary toast: "Generated X documents successfully."

**Edge Function Request Format**:

```typescript
{
  content: string;              // Transcript + optional context
  project_id: string;          // From selectedProject?.id (REQUIRED)
  meeting_transcript_id?: string;  // For tracking relationship
  user_id?: string;            // From user?.id
  system_prompt?: string;      // Optional override
  user_prompt?: string;        // Optional override
  previous_response_id?: string;   // For conversation continuity
  model?: string;              // Optional model override
  temperature?: number;         // Optional override
  token_limit?: number;        // Optional override
}
```

**Edge Function Response Format**:

```typescript
{
  success: boolean;
  document?: string;           // Generated Markdown content
  response_id?: string;        // OpenAI response ID for tracking
  document_id?: string;        // Database document ID
  error?: string;              // Error message if failed
}
```

**Technical Implementation**:
- Service: `generateDocumentAPI()` from `src/lib/services/document-generation-service.ts`.
- Edge Function invocation: `supabase.functions.invoke(functionName, { body: requestBody })`.
- Shared types: `supabase/functions/_shared/document-generation/types.ts`.
- Document types: centralized in `DocumentTypes` system.
- Sequential processing: `SequentialGenerationProgress` component.
- All document generation uses Edge Functions (no direct frontend OpenAI calls).

**Error Handling**:
- If API key not configured: display "API key not configured. Please configure your OpenAI API key in settings."
- If rate limit exceeded: display "Rate limit exceeded. Please try again later."
- If quota exceeded: display "Rate limit exceeded. Please try again later."
- If generation fails: mark the step as error and allow retry.
- If network error: display retry option.

---

## Appendix A: Key Hooks Reference

| Hook | Location | Purpose |
|------|----------|---------|
| `useAuth` | `src/contexts/AuthContext.tsx` | Authentication state (user, signIn, signUp, signOut) |
| `useProjectSelection` | `src/contexts/ProjectSelectionContext.tsx` | Project context and selection |
| `useTasks` | `src/hooks/useTasks.ts` | Task data fetching and operations |
| `useSprints` | `src/hooks/useSprints.ts` | Sprint data and CRUD operations |
| `useMeetings` | `src/hooks/useMeetings.ts` | Meeting data fetching |
| `useMeetingMutations` | `src/hooks/useMeetingMutations.ts` | Meeting create/update/delete |
| `useTeamMembers` | `src/hooks/useTeamMembers.ts` | Team member data |
| `useMeetingWithTranscript` | `src/hooks/useMeetingWithTranscript.ts` | Meeting with transcript data |
| `generateDocumentAPI` | `src/lib/services/document-generation-service.ts` | Document generation via Edge Functions |
| `useCentralizedDocumentTypes` | `src/hooks/useCentralizedDocumentTypes.ts` | Centralized document type definitions |

---

## Appendix B: Critical Implementation Rules

### Rule 1: Project Selection

**ALWAYS** access the project ID via `selectedProject?.id`:

```typescript
// CORRECT
const { selectedProject } = useProjectSelection();
const projectId = selectedProject?.id;

// Use projectId in queries
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', projectId);

// INCORRECT - this property does not exist
const { selectedProjectId } = useProjectSelection();
```

### Rule 2: Authentication Flow

All authenticated pages must follow this pattern:

```typescript
const { user } = useAuth();
const { selectedProject } = useProjectSelection();

// Check authentication
if (!user) {
  return <Navigate to="/login" replace />;
}

// Check project selection
if (!selectedProject) {
  return <Alert>Please select a project first.</Alert>;
}
```

### Rule 3: Document Generation

**ALL** document generation must use `generateDocumentAPI()` from `document-generation-service.ts`. Do not call OpenAI directly from the frontend.

```typescript
import { generateDocumentAPI } from '@/lib/services/document-generation-service';

const result = await generateDocumentAPI(
  'user-story',           // Document type
  transcriptContent,      // Input content
  selectedProject?.id,    // Project context
  meetingTranscriptId,    // Optional transcript ID
  user?.id               // Optional user ID
);

if (result.success) {
  // Document generated and saved automatically
  console.log('Response ID:', result.response_id);
} else {
  // Handle error
  console.error(result.error);
}
```

### Rule 4: Query Scoping

All database queries must be scoped by project:

```typescript
// CORRECT - always filter by project_id
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', selectedProject?.id);

// INCORRECT - missing project filter
const { data } = await supabase
  .from('tasks')
  .select('*');
```

---

## Appendix C: Related Documentation

- [Authentication System](../05-authentication/auth-flows.md)
- [Project Context System](../06-project-context/context-system.md)
- [Task Management](../21-tasks/tasks.md)
- [Sprint Management](../20-sprints/sprints.md)
- [Meeting Transcripts](../23-meeting-transcripts/transcripts.md)
- [Document Generation API](../17-document-generation/api.md)
