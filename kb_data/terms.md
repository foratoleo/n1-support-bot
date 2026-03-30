---
name: glossary-terms
description: Key terms and definitions used throughout the Workforce project
area: 03
maintained_by: glossary-writer
created: 2026-03-30
updated: 2026-03-30
---

# Glossary of Key Terms

## AI Interactions (ai_interactions table)

A database table that tracks every call made to the OpenAI API, recording token usage, cost, model used, and the response ID returned by OpenAI. This table is populated automatically by Edge Functions during document generation. It serves as the system of record for monitoring AI consumption and billing. Each interaction is linked to a project via `project_id` and optionally to a user via `user_id`. The table enables cost analysis per project, per user, and per document type.

Related terms: response_id, OpenAI Responses API, Edge Functions, document generation (v2.0)

---

## Area Themes

A set of CSS custom property definitions that apply distinct visual styling to each of the four project phases: Planning, Development, Testing/Quality, and Governance. Each area has a primary color, accent color, and background tint. The themes are applied via the `data-area` attribute on DOM elements (e.g., `data-area="planning"`). This visual differentiation helps users quickly identify which phase they are working within.

| Area | Primary Color | Accent Color |
|------|--------------|--------------|
| Planning | Dark Gold (#B8860B) | Goldenrod (#DAA520) |
| Development | Gray (#9E9E9E) | Silver (#C0C0C0) |
| Testing/Quality | Bronze (#CD7F32) | Tan (#D4A574) |
| Governance | Dark Green (#1B4332) | Forest Green (#2D6A4F) |

Related terms: Project Context

---

## AuthContext

A React Context that encapsulates all authentication state and operations for the application. It provides the current user session, methods for signing in and out, and the loading state of the authentication process. AuthContext is built on top of Supabase Auth and is the primary mechanism through which any component accesses the authenticated user.

Related terms: React Context, Supabase (RLS, Auth, Storage), ProjectSelectionContext, TeamContext

---

## Conversation IDs

Identifier strings returned by the OpenAI Responses API that maintain continuity across multiple related API calls within a single document generation session. When generating multiple documents from the same transcript (e.g., a PRD and its associated User Stories), the `previous_response_id` from one call is passed as `previous_response_id` in the next, allowing the model to maintain context. This enables coherent multi-document generation workflows.

Related terms: response_id, OpenAI Responses API, Edge Functions, document generation (v2.0)

---

## Document Generation (v2.0)

The current architecture for generating AI-powered documents from meeting transcripts. In v2.0, all document generation flows through Supabase Edge Functions, which call the OpenAI API server-side. This replaces the deprecated v1.0 frontend-based approach where OpenAI was called directly from the React client. The v2.0 architecture provides centralized API key management, automatic token tracking, consistent error handling, and server-side model selection optimization.

Supported document types: PRD, User Stories, Meeting Notes, Technical Specs, Test Cases.

Related terms: Edge Functions, AI interactions (ai_interactions table), response_id, conversation IDs, OpenAI Responses API, generated_documents, meeting_transcript

---

## Edge Functions

Serverless functions hosted on Supabase that execute in a Deno runtime environment. In the Workforce project, Edge Functions handle all document generation requests. Each document type has its own function (e.g., `create-prd`, `create-user-story`), while shared logic resides in `/supabase/functions/_shared/document-generation/`. Edge Functions receive requests from the frontend via the `document-generation-service.ts` wrapper, call the OpenAI API, automatically record usage in the `ai_interactions` table, and return structured responses.

Related terms: document generation (v2.0), OpenAI Responses API, AI interactions (ai_interactions table), response_id

---

## generated_documents

A database table that stores the output of AI-generated documents. Each record contains the document content (in Markdown format), the document type, the associated project ID, and a reference to the source meeting transcript if applicable. Documents are versioned using the `is_current_version` flag, allowing historical versions to be preserved while marking the latest version.

Related terms: meeting_transcript, is_current_version flag, document generation (v2.0), Project Context

---

## Handlebars Templates

Template files used by Edge Functions to construct prompts sent to the OpenAI API for document generation. Handlebars syntax (e.g., `{{variable}}`, `{{#each items}}...{{/each}}`) allows dynamic insertion of transcript content and metadata into a structured prompt framework. Templates are stored in `src/prompts/document-templates/` and versioned via the `is_current_version` flag in the database, enabling template updates without code deployments.

Related terms: document generation (v2.0), is_current_version flag, OpenAI Responses API

---

## is_current_version Flag

A boolean field in the database that marks the active version of a document template. When a template is updated, the previous version's flag is set to `false` and the new version's flag is set to `true`. This versioning mechanism allows Edge Functions to always load the current template while preserving historical versions for audit or rollback purposes.

Related terms: Handlebars Templates, Edge Functions, document generation (v2.0)

---

## meeting_transcript

A database table that stores raw transcript data from recorded meetings. Each transcript record contains the full text content, metadata such as date and participants, and a reference to the project it belongs to. Meeting transcripts serve as the input source for document generation. Components like `DocumentGenerator.tsx` and `RelatedDocuments.tsx` read from this table to allow users to generate documents from past meetings.

Related terms: document generation (v2.0), generated_documents, Project Context

---

## OpenAI Responses API

The OpenAI API endpoint used by Edge Functions for document generation. Unlike the traditional chat completions endpoint, the Responses API is designed for multi-turn conversation continuity and returns a `response_id` that can be used in subsequent calls via the `previous_response_id` parameter. The API supports automatic token counting and is accessed server-side within Edge Functions, keeping API keys secure.

Related terms: response_id, conversation IDs, Edge Functions, document generation (v2.0), AI interactions (ai_interactions table)

---

## Project Context

The active project scope that filters all data within the application. Every query, mutation, and display in the Workforce app is constrained to the currently selected project. This isolation ensures that data from one project never leaks into another. The active project is accessed via the `selectedProject` object from the `useProjectSelection` hook. All Supabase queries must include an `.eq('project_id', selectedProject.id)` filter. The `selectedProject` object contains the full project record, including `id`, `name`, and other metadata.

Related terms: selectedProject, useProjectSelection hook, Supabase (RLS, Auth, Storage)

---

## React Context

A React pattern for sharing state across components without prop drilling. The Workforce project uses three primary contexts: `AuthContext` manages user authentication state, `ProjectSelectionContext` manages the currently active project, and `TeamContext` manages team member data. Contexts are consumed via custom hooks (e.g., `useProjectSelection()`) that provide a clean API surface to components while abstracting the underlying context implementation.

Related terms: AuthContext, ProjectSelectionContext, TeamContext, useProjectSelection hook

---

## response_id

A unique identifier string returned by the OpenAI Responses API with every API response. In the Workforce project, `response_id` is stored in the `ai_interactions` table for tracking and auditing purposes. It is also used as `previous_response_id` in subsequent API calls to maintain conversation continuity across multi-document generation sessions.

Related terms: OpenAI Responses API, conversation IDs, AI interactions (ai_interactions table), Edge Functions

---

## RLS (Row Level Security)

A Supabase feature that enforces data access rules at the database level. RLS policies define which rows a user can read, insert, update, or delete based on their authentication status and the contents of the row. In the Workforce project, RLS policies are configured per table to enforce Project Context isolation, ensuring users can only access data from projects they belong to. RLS is a critical security layer complementing application-level filtering.

Related terms: Supabase (RLS, Auth, Storage), Project Context, AuthContext

---

## selectedProject

The primary object representing the currently active project in the application. It is obtained by destructuring from the `useProjectSelection()` hook. The object contains the full project record, and the most critical property is `.id`, which must be used in all database queries to enforce Project Context isolation.

**CRITICAL**: Always access via `selectedProject?.id`. The property `selectedProjectId` does not exist on the object returned by `useProjectSelection()`. Using `selectedProjectId` will result in undefined behavior and silent data leakage or loss.

Correct usage:
```typescript
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;
// Use selectedProjectId in .eq('project_id', selectedProjectId)
```

Incorrect usage:
```typescript
// WRONG - selectedProjectId does not exist
const { selectedProjectId } = useProjectSelection();
```

Related terms: Project Context, useProjectSelection hook, Supabase (RLS, Auth, Storage)

---

## Sprint Velocity

A metric that measures the amount of work a team completes during a sprint, typically expressed in story points or task count. Velocity is calculated by summing the completed items in a sprint and is used to forecast future sprint capacity. In the Workforce project, sprint velocity is tracked in the `sprints` table alongside sprint dates and planned capacity, enabling teams to balance workload against historical performance.

Related terms: dev_tasks

---

## Supabase (RLS, Auth, Storage)

The backend-as-a-service platform that powers the Workforce project's data layer. Supabase provides four integrated services used in this project: PostgreSQL (the database), Auth (user authentication), Storage (file uploads), and Edge Functions (serverless code execution). All database operations are performed through the Supabase JavaScript client, and security is enforced through a combination of RLS policies and application-level Project Context filtering.

Related terms: RLS (Row Level Security), AuthContext, Edge Functions, Project Context

---

## TanStack Query v5

A data fetching and caching library for React used throughout the Workforce project to manage server state. TanStack Query (formerly React Query) handles fetching, caching, synchronizing, and updating data from the Supabase backend. It replaces manual `useEffect` + `useState` patterns with a declarative API that includes automatic background refetching, stale-while-revalidate caching, and query invalidation. All components use TanStack Query hooks to fetch data from Supabase.

Related terms: React Context, Supabase (RLS, Auth, Storage)

---

## TeamContext

A React Context that manages team member data within the active project. It provides access to the list of team members, their roles, and methods for adding or updating members. TeamContext is scoped to the current project via `selectedProject?.id`, ensuring team data is isolated per project. It complements `AuthContext` and `ProjectSelectionContext` as one of the three primary state contexts in the application.

Related terms: React Context, AuthContext, ProjectSelectionContext, Project Context

---

## useProjectSelection Hook

A custom React hook that provides access to the currently selected project. It is the primary interface for reading the Project Context within any component. The hook returns an object containing `selectedProject` (the full project record) and `setSelectedProject` (a function to change the active project). It must not be destructured using `selectedProjectId` as that property does not exist on the returned object.

Correct usage:
```typescript
const { selectedProject } = useProjectSelection();
```

Related terms: Project Context, selectedProject, React Context, ProjectSelectionContext
