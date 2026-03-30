---
name: project-overview
description: Project mission, tech stack, architecture overview, and key patterns
area: 01
maintained_by: foundation-architect
created: 2026-03-30
updated: 2026-03-30
---

# Project Overview

## Overview

RAG Workforce is an AI-powered workforce management and collaboration platform designed to streamline project planning, meeting documentation, and team coordination through intelligent document generation and retrieval-augmented workflows.

The platform serves teams that need to capture meeting transcripts, generate structured documentation (PRDs, user stories, technical specs, test cases, meeting notes), and manage development tasks within a unified project context. By leveraging OpenAI's Responses API and a sophisticated retrieval system, the application transforms raw meeting content into actionable project artifacts while maintaining strict project-based data isolation.

The system architecture prioritizes security and maintainability by centralizing AI operations on the server side via Supabase Edge Functions, eliminating API key exposure on the client, automating token usage tracking, and providing consistent error handling across all document generation workflows.

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.x | UI framework with concurrent features |
| TypeScript | 5.8.x | Type-safe development |
| Vite | 7.3.x | Build tool and dev server |
| Tailwind CSS | 3.4.x | Utility-first styling |
| Shadcn/ui | latest | Component library on Radix UI primitives |
| TanStack Query | 5.83.x | Server state management |
| React Router DOM | 6.30.x | Client-side routing |
| Framer Motion | 12.x | Animation and transitions |
| Monaco Editor | 0.55.x | Code and document editing |
| TipTap | 3.9.x | Rich text editing |
| React Hook Form | 7.62.x | Form state management |
| Zod | 3.25.x | Schema validation |
| i18next | 25.5.x | Internationalization |

### Backend and Infrastructure

| Technology | Purpose |
|-----------|---------|
| Supabase | PostgreSQL database, authentication, storage, edge functions |
| Supabase Edge Functions | Server-side AI document generation (Deno runtime) |
| OpenAI API | GPT-4o and GPT-4o-mini for document generation |

### Development and Quality

| Technology | Purpose |
|-----------|---------|
| Vitest | Unit and integration testing |
| Playwright | End-to-end testing |
| ESLint | Code linting (flat config) |
| Vite ESLint Plugin | Fast lint feedback during development |

## Architecture Diagram

```
+------------------------------------------------------------------+
|                         CLIENT (React 18)                         |
|                                                                   |
|  +-------------------+    +-------------------+                  |
|  |   Pages / Routes  |    |   UI Components   |                  |
|  +-------------------+    +-------------------+                  |
|           |                       |                              |
|  +---------------------------------------------------+           |
|  |              State Management Layer               |           |
|  |  TanStack Query (server state)                    |           |
|  |  React Context (auth, project, team)             |           |
|  |  Component useState (local UI state)              |           |
|  +---------------------------------------------------+           |
|           |                                                     |
|  +-------------------+    +-------------------+                  |
|  |   Hooks           |    |   Services        |                  |
|  |   useProjectSel.. |    |   document-gen... |                  |
|  |   useTasks        |    |   supabase-client |                  |
|  +-------------------+    +-------------------+                  |
+------------------------------------------------------------------+
            |
            | HTTPS (REST)
            v
+------------------------------------------------------------------+
|                     SUPABASE LAYER                                |
|                                                                   |
|  +-------------------+    +-------------------+                  |
|  |  Supabase Client  |    |   Row Level Sec.  |                  |
|  |  (Auth + Database)|    |   (project_id)    |                  |
|  +-------------------+    +-------------------+                  |
|           |                                                     |
|  +-------------------+    +-------------------+                  |
|  |  PostgreSQL Tables|    |   Storage Bucket  |                  |
|  |  project_knowledge|    |   (files/assets)  |                  |
|  |  dev_tasks        |    +-------------------+                  |
|  |  meeting_transcr..|                                           |
|  |  generated_doc... |                                           |
|  |  ai_interactions  |                                           |
|  |  sprints, teams   |                                           |
|  +-------------------+                                           |
+------------------------------------------------------------------+
            |
            | Local invoke (internal)
            v
+------------------------------------------------------------------+
|                  SUPABASE EDGE FUNCTIONS                          |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |              _shared/document-generation/                   | |
|  |              (types, utilities, shared logic)              | |
|  +-------------------------------------------------------------+ |
|           |              |              |              |         |
|  +----------------+ +----------------+ +----------------+     |
|  |  create-prd   | |create-user-    | |create-meeting- |     |
|  |               | |story          | |notes           |     |
|  +----------------+ +----------------+ +----------------+     |
|           |              |              |                       |
|  +----------------+ +----------------+ +----------------+     |
|  |create-technical| |create-test-    | |create-unit-    |     |
|  |-specs          | |cases           | |tests           |     |
|  +----------------+ +----------------+ +----------------+     |
|           |              |              |                       |
|  +----------------+                                              |
|  |analyze-transcr.|                                              |
|  +----------------+                                              |
+------------------------------------------------------------------+
            |
            | HTTPS (OpenAI API)
            v
+------------------------------------------------------------------+
|                        OPENAI API                                 |
|                                                                   |
|  +-------------------+    +-------------------+                  |
|  |   GPT-4o         |    |  Responses API    |                  |
|  |   (complex docs) |    |  (conversation)   |                  |
|  +-------------------+    +-------------------+                  |
|  +-------------------+                                           |
|  |  GPT-4o-mini     |                                           |
|  |  (simple docs)   |                                           |
|  +-------------------+                                           |
+------------------------------------------------------------------+
```

## Key Architectural Patterns

### 1. Project Context System

All data operations in the application are scoped to a selected project. The `useProjectSelection()` hook provides the active project context, and every database query must filter by `project_id` to ensure proper data isolation.

```typescript
// CORRECT: Access project via selectedProject property
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;

// All queries MUST include project_id filter
const { data, error } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProjectId)
  .order('created_at', { ascending: false });
```

Key constraint: Never destructure a `selectedProjectId` property from the hook. The hook exposes `selectedProject` (the full object), not `selectedProjectId` directly. Attempting to use a non-existent property will result in undefined behavior and silent query failures.

### 2. OpenAI Integration v2.0 (Edge Function Based)

The document generation system has migrated from frontend OpenAI calls to server-side Edge Functions. This architectural change provides several benefits over the legacy approach.

**Document Generation Pipeline**:

```
User Action (e.g., generate PRD)
    |
    v
generateDocumentAPI()  [src/lib/services/document-generation-service.ts]
    |
    v
Supabase Edge Function (e.g., /create-prd)
    |
    v
OpenAI Responses API (GPT-4o or GPT-4o-mini)
    |
    +--> ai_interactions table (automatic token tracking)
    |
    v
generated_documents table (document storage)
    |
    v
Structured response to client { success, document?, response_id?, error? }
```

**Supported Document Types**:

| Document Type | Edge Function | Description |
|---------------|---------------|-------------|
| PRD | `create-prd` | Product Requirements Document |
| User Stories | `create-user-story` | User story generation |
| Meeting Notes | `create-meeting-notes` | Structured meeting summary |
| Technical Specs | `create-technical-specs` | Technical implementation details |
| Test Cases | `create-test-cases` | Test scenarios and validation |
| Unit Tests | `create-unit-tests` | Code unit test generation |
| Transcript Analysis | `analyze-transcript` | Meeting content analysis |

**Migration from v1.0**:

The legacy architecture called OpenAI directly from the frontend using `generateDocumentsWithOpenAI()` in `src/lib/openai.ts`. This approach is now deprecated for document generation due to the following issues:

- API keys were exposed to the client browser
- Token usage tracking required manual inserts into the `ai_interactions` table
- Error handling was distributed across components with no consistent format
- Model selection logic was duplicated and inconsistent

The v2.0 migration removed direct frontend-to-OpenAI calls, eliminated manual `aiInteractionId` state management, and added server-side automatic token tracking with structured error responses mapped to internationalized messages.

**Legacy Support**: The deprecated `generateDocumentsWithOpenAI` function remains in use only for task creation workflows that have not yet been migrated to Edge Functions.

### 3. Supabase Edge Functions

Edge Functions are located in `supabase/functions/` and written in TypeScript running on the Deno runtime. They share infrastructure through a common module at `_shared/document-generation/`.

**Directory Structure**:

```
supabase/functions/
|
+-- _shared/document-generation/
|   +-- types.ts         (TypeScript interfaces for request/response)
|   +-- openai-client.ts (OpenAI configuration and client setup)
|   +-- prompt-loader.ts (Handlebars template loading and caching)
|   +-- retry.ts         (Exponential backoff retry logic)
|   +-- tracking.ts      (ai_interactions logging)
|
+-- create-prd/index.ts
+-- create-user-story/index.ts
+-- create-meeting-notes/index.ts
+-- create-technical-specs/index.ts
+-- create-test-cases/index.ts
+-- create-unit-tests/index.ts
+-- analyze-transcript/index.ts
```

**Request Format**:

```typescript
interface EdgeFunctionRequest {
  content: string;                  // Transcript or input content
  project_id: string;              // Project identifier (required)
  meeting_transcript_id?: string;  // Optional transcript reference
  user_id?: string;                 // Optional user tracking
  system_prompt?: string;          // Optional custom system prompt override
  user_prompt?: string;            // Optional custom user prompt override
  previous_response_id?: string;    // For conversation continuity
  model?: string;                  // Optional model override
  temperature?: number;            // Optional temperature override
  token_limit?: number;           // Optional token limit override
}
```

**Response Format**:

```typescript
interface EdgeFunctionResponse {
  success: boolean;       // Operation status
  document?: string;     // Generated document (Markdown format)
  response_id?: string; // OpenAI response ID for tracking
  error?: string;        // Error message if failed
}
```

**Error Handling Strategy**: Edge Functions return structured errors that map to user-friendly internationalized messages. Common error scenarios include authentication failures when the API key is not configured, quota exceeded when rate limits are hit, and validation errors when request format is invalid.

### 4. Template System

Document generation uses Handlebars templates stored in `src/prompts/document-templates/`. Templates are version-controlled with an `is_current_version` flag in the database, allowing controlled rollout of template changes without code deployments. Edge Functions load templates at runtime, and the Responses API maintains conversation continuity through response IDs, enabling multi-step document generation sessions.

### 5. Area-Based Design Theming

The application visualizes four distinct work areas, each with its own color identity applied through CSS custom properties on the `data-area` attribute:

| Area | Primary Color | Accent | Purpose |
|------|--------------|--------|---------|
| Planning | `#B8860B` (Dark Gold) | `#DAA520` | PRD, user stories, requirements |
| Development | `#9E9E9E` (Gray/Silver) | `#C0C0C0` | Task management, sprints |
| Testing/Quality | `#CD7F32` (Bronze) | `#D4A574` | Test cases, quality assurance |
| Governance | `#1B4332` (Dark Green) | `#2D6A4F` | Policies, compliance, audits |

## Design Philosophy

### Security by Design

API keys are never exposed to the client. All OpenAI interactions occur server-side within Supabase Edge Functions, eliminating the risk of key theft through client-side code inspection or network attacks. Token usage is tracked automatically on the server, providing accurate cost attribution without relying on client-side reporting.

### Data Isolation

Every table in the database is organized by `project_id`. Row Level Security (RLS) policies enforce this isolation at the database layer, ensuring that users can only access data within projects they are authorized to view. This architectural decision prevents data leakage between projects even if application-level checks are bypassed.

### Separation of Concerns

The frontend focuses purely on UI rendering and user interaction. Business logic related to AI document generation resides entirely in Edge Functions, and data access is mediated through Supabase. This separation allows each layer to evolve independently and simplifies testing by enforcing clear boundaries.

### Internationalization First

All user-facing text is externalized into translation files (`src/locales/pt-br.ts`, `src/locales/en-us.ts`) and accessed through the `useI18n` hook. This ensures the application can be localized without code changes and that all strings follow a consistent naming convention organized by namespace.

### State Management Transparency

Server state is managed by TanStack Query, which provides caching, background refetching, and optimistic updates. Application state (authentication, project selection, team context) uses React Context, making the state flow predictable and debuggable without external state inspection tools.

## Related Topics

- [Folder Structure](/docs/02-folder-structure/structure.md) - Directory layout and file organization
- [Glossary](/docs/03-glossary/terms.md) - Key terminology and definitions
- [Database Schema](/docs/04-database-schema/schema.md) - Table structure, relationships, and RLS policies
- [Edge Functions Reference](/docs/08-document-generation/edge-functions.md) - Detailed API documentation for each function
- [Document Generation Service](/docs/12-supabase-functions/functions.md) - Client-side API wrapper documentation
- [Frontend Style Guide](/docs/Code%20Rules/frontend-style-guide.md) - Component patterns and code conventions
- [SQL Style Guide](/docs/Code%20Rules/sql-style-guide.md) - Database query conventions
- [Area Theming System](/docs/16-ui-theming/themes.md) - Design system for work areas
