---
name: prompt-templates
description: Template system, Handlebars syntax, versioning, and template loading
area: 09
maintained_by: template-writer
created: 2026-03-30
updated: 2026-03-30
---

# Prompt Templates

## Overview

The prompt template system provides structured, versioned templates for AI-powered document generation. Templates are authored in Markdown with Handlebars syntax for dynamic content injection, stored at `src/prompts/document-templates/`, and loaded server-side by Supabase Edge Functions. The system supports six core document types: PRD, User Stories, Meeting Notes, Technical Specs, Test Cases, and Tasks.

The template architecture follows a three-layer precedence model: request overrides take highest priority, database configuration comes second, and default values serve as the fallback. This design allows per-project customization while maintaining sensible defaults.

## Template Files

Templates reside in `src/prompts/document-templates/` and are organized by document type:

| File | Document Type | Purpose |
|------|--------------|---------|
| `base-instructions.md` | All types | Global AI behavior rules (language, output format, constraints) |
| `prd.md` | PRD | Product Requirements Document structure |
| `user-stories.md` | User Story | Agile user story generation |
| `meeting-notes.md` | Meeting Notes | Structured meeting summary |
| `technical-specs.md` | Technical Specs | Technical implementation details |
| `test-cases.md` | Test Cases | Test scenarios and validation plans |
| `tasks.md` | Tasks | Technical task decomposition and planning |

The `base-instructions.md` file is special: it defines universal rules applied to all document generation operations. It specifies that all AI output must be in Brazilian Portuguese, that the AI must not fabricate information (using `[TBD]` or `[MISSING]` for unknown data), and that the AI must follow the provided template structure exactly without adding or removing sections.

## Handlebars Syntax Reference

Handlebars provides three categories of expression: variables, conditionals, and iteration. All templates use these consistently.

### Variables

Variables interpolate single values into the output. The syntax uses double curly braces with optional dot notation for nested property access:

```handlebars
# Meeting Notes - {{ meeting.title }}

**Project:** {{ project.name }}
**Date:** {{ meeting.date }}
**Coverage:** {{ coverage.percentage }}%
```

For array indexing within an iteration context, the `@index` variable is available:

```handlebars
#### Test Case {{ @index + 1 }}: {{ this.name }}
```

Dot notation traverses nested objects:

```handlebars
- Load Time: {{ performance.loadTime }}ms
- Response Time: {{ performance.responseTime }}ms
```

### Conditionals

Conditionals render a block only when a value is truthy. The inverse block (`{{else}}`) renders when the value is falsy:

```handlebars
{{ #each e2eTests }}
#### Test Case {{ @index + 1 }}: {{ this.name }}
- **Edge Cases:** {{ this.edgeCases }}
{{ /each }}
```

Note that the `{{ #each }}` block helper iterates over arrays, while the root-level `{{ #each }}` can also iterate over object keys. For conditional output based on a boolean flag:

```handlebars
{{ #if this.isCritical }}
- **Severity:** CRITICAL
{{ else }}
- **Severity:** {{ this.severity }}
{{ /if }}
```

### Loops and Iteration

The `{{ #each }}` block helper iterates over arrays. Inside the block, `this` refers to the current item, and `@index` provides the zero-based position:

```handlebars
### 2. Integration Tests
{{ #each integrationTests }}
#### Test Case {{ @index + 1 }}: {{ this.name }}
- **Modules:** {{ this.modules }}
- **Scenario:** {{ this.scenario }}
- **Steps:**
  {{ #each this.steps }}
  {{ @index + 1 }}. {{ this }}
  {{ /each }}
- **Expected Result:** {{ this.expectedResult }}
{{ /each }}
```

Nested `{{ #each }}` blocks are supported for multi-level data structures. The inner block maintains its own `@index` and `this` context.

### Comments

Handlebars comments are stripped from the output:

```handlebars
{{! This comment will not appear in the output }}
```

### Example: Full Meeting Notes Template

```handlebars
# Meeting Notes - {{ meeting.title }}

## Meeting Details
**Date:** {{ meeting.date }}
**Time:** {{ meeting.time }}
**Duration:** {{ meeting.duration }}
**Type:** {{ meeting.type }}
**Facilitator:** {{ meeting.facilitator }}

## Attendees
{{ #each attendees }}
- **{{ this.name }}** - {{ this.role }} ({{ this.department }})
{{ /each }}

## Action Items
| Item | Owner | Due Date | Priority | Status |
|------|-------|----------|----------|--------|
{{ #each actionItems }}
| {{ this.item }} | {{ this.owner }} | {{ this.dueDate }} | {{ this.priority }} | {{ this.status }} |
{{ /each }}

## Decisions Log
{{ #each decisions }}
### Decision {{ @index + 1 }}: {{ this.title }}
- **Context:** {{ this.context }}
- **Decision:** {{ this.decision }}
- **Rationale:** {{ this.rationale }}
- **Impact:** {{ this.impact }}
{{ /each }}

## Meeting Metrics
- **Attendance Rate:** {{ metrics.attendanceRate }}%
- **Action Items Generated:** {{ metrics.actionItems }}
- **Decisions Made:** {{ metrics.decisions }}
```

## Template Versioning

Templates are versioned through the `is_current_version` flag on the `generated_documents` table in the database. When a new document is generated, the system marks all previous versions of that type for the current project as non-current before inserting the new record.

The versioning strategy follows this pattern:

1. When generating a new PRD, all existing PRD records for the project have `is_current_version` set to `false`.
2. The newly generated PRD is inserted with `is_current_version = true`.
3. The AI model receives the conversation history via `previous_response_id`, enabling it to reference prior outputs when refining or extending documents.
4. Historical versions are retained for audit trails and rollback purposes.

This approach decouples template versioning from document versioning: the template files in `src/prompts/document-templates/` represent the current template logic, while the database tracks individual generated documents and their lineage through conversation IDs.

## Document Types

### PRD (Product Requirements Document)

The PRD template (`prd.md`) produces comprehensive product requirement documents with seven required sections:

1. Executive Summary -- product vision, key meeting insights, primary objectives
2. Problem Statement -- problem definition, current pain points, impact of inaction
3. Solution Overview -- proposed approach, core components, expected outcomes
4. Functional Requirements -- features, user interactions, system behaviors
5. Non-Functional Requirements -- performance, security, scalability, compatibility
6. User Personas -- user types, characteristics, use cases per persona
7. Success Metrics -- KPIs, measurement criteria, milestones

### User Stories

The User Stories template (`user-stories.md`) generates agile stories in the standard three-line format, grouped by epic or feature area. Each story includes acceptance criteria using Given/When/Then notation, priority level, effort estimate, and dependencies.

The template enforces that stories remain user-focused and value-driven, avoiding technical implementation details at the story level. Technical tasks derived from stories are tracked separately.

### Meeting Notes

The Meeting Notes template (`meeting-notes.md`) produces structured summaries with variable sections including meeting metadata, attendee list, agenda, discussion points, decisions made, action items with ownership and due dates, risks and issues, follow-up items, and meeting metrics.

### Technical Specs

The Technical Specs template (`technical-specs.md`) generates implementation-ready specifications covering system architecture, API endpoints, database schema, security requirements, performance requirements, and technical constraints. This template uses technical terminology and includes code snippet placeholders.

### Test Cases

The Test Cases template (`test-cases.md`) produces extensive test documentation covering unit tests, integration tests, end-to-end tests, manual test plans, and user acceptance testing scenarios. Each test includes input data, expected outputs, preconditions, steps, and status tracking.

### Tasks

The Tasks template (`tasks.md`) generates granular technical task breakdowns. Unlike other templates, it outputs structured JSON instead of Markdown. Each task includes title, description, task_type, priority, estimated hours, story points, dependencies, and developer assignment. The template implements a developer scoring algorithm based on skills, availability, and workload.

## How Edge Functions Load and Use Templates

Templates are not loaded from the filesystem at runtime. Instead, each Edge Function contains its own hardcoded prompt definitions in a `config.ts` file. This approach avoids filesystem access complexity in the Deno runtime and ensures templates are deployed alongside the function code.

The loading chain follows this sequence:

1. The Edge Function handler receives a `RequestBody` with `content`, `project_id`, and optional overrides (`system_prompt`, `user_prompt`, `model`, `temperature`, `token_limit`, `previous_response_id`).

2. The function calls `loadConfiguration()` which queries the `platform_settings` table for the relevant configuration key (e.g., `ai-create-prd`, `ai-create-user-story`). If found, the database values override defaults.

3. The function calls `buildPrompts()` which merges the configuration sources following precedence: request overrides > database config > default config. The `replacePromptPlaceholders()` utility injects the user content into the prompt template using `{{content}}` or `{{transcript}}` placeholders.

4. The constructed prompts are passed to `OpenAIService.generateDocument()` along with the selected model, temperature, and token limits.

5. The generated document is stored in `generated_documents` with the appropriate `document_type` and `is_current_version = true`.

The configuration precedence is logged for debugging:

```typescript
console.log(`${logPrefix} Configuration sources:`, {
  model: 'request' | 'database' | 'default',
  temperature: 'request' | 'database' | 'default',
  token_limit: 'request' | 'database' | 'default'
});
```

### Default Configuration Example

Each Edge Function defines its defaults in `config.ts`. For example, `create-prd/config.ts`:

```typescript
export const CONFIG_KEY = 'ai-create-prd';

export const DEFAULT_SYSTEM_PROMPT = `You are a specialized Product Requirements Document (PRD) generator...`;

export const DEFAULT_USER_PROMPT = `Generate a detailed Product Requirements Document based on the following content:`;

export const OPENAI_CONFIG: OpenAIConfig = {
  model: 'gpt-4o',
  max_output_tokens: 8000,
  token_limit: 8000,
  temperature: 0.6,
  store: false
};
```

## Conversation IDs for Multi-Document Sessions

The OpenAI Responses API supports conversation continuity through `previous_response_id`. When generating multiple related documents, passing the previous response ID allows the model to maintain context across the session.

Use `generateDocumentAPI()` with the `previous_response_id` parameter:

```typescript
import { generateDocumentAPI } from '@/lib/services/document-generation-service';

// Generate first document
const result1 = await generateDocumentAPI(
  'prd',
  meetingTranscriptContent,
  projectId,
  meetingTranscriptId
);

// Generate follow-up document with conversation continuity
const result2 = await generateDocumentAPI(
  'user-stories',
  additionalContent,
  projectId,
  undefined,           // no transcript ID
  undefined,           // no user ID
  result1.response_id  // maintain conversation context
);
```

The `previous_response_id` is stored in the `ai_interactions` table via the `previous_interaction_id` field, enabling audit trails of multi-document generation chains.

## Automatic Model Selection

The system uses automatic model selection based on document complexity:

| Model | Use Case | Configuration |
|-------|----------|---------------|
| `gpt-4o` | Complex documents (PRD, Technical Specs, Test Cases) | `temperature: 0.6`, `max_output_tokens: 8000` |
| `gpt-4o-mini` | Simple documents (Task notes, quick summaries) | Lower token limits, faster response |

The model is selected through the configuration merge process in `loadConfiguration()`. The default config for each document type specifies the appropriate model, which can be overridden per-request or per-project through the `platform_settings` database table.

The `temperature` setting of `0.6` balances determinism with creative flexibility, ensuring consistent document structure while allowing natural language variation.

Token limits are set to 8000 by default for complex documents, accommodating full PRD and technical specification outputs. The `token_limit` field maps to `max_output_tokens` in the OpenAI API request.

## Prompt Placeholder System

The `replacePromptPlaceholders()` function in `types.ts` handles dynamic content injection:

```typescript
export function replacePromptPlaceholders(prompt: string, content: string): string {
  return prompt
    .replace(/\{\{content\}\}/g, content)
    .replace(/\{\{transcript\}\}/g, content);
}
```

Both `{{content}}` and `{{transcript}}` are supported as placeholders, providing flexibility in how prompts are authored. The function uses regex replacement with the global flag to replace all occurrences.

## Language and Output Rules

All templates and AI outputs default to Brazilian Portuguese, as enforced by `base-instructions.md`. The base instructions define critical rules:

- Output language: Always Brazilian Portuguese unless explicitly told otherwise
- Information integrity: Never fabricate dates, numbers, or scope. Use `[TBD]` or `[MISSING]` for unknown information
- Structure adherence: Never change or ignore the template structure
- Detail preservation: Maintain the level of detail in the source; do not infer non-existent details

These rules are embedded in the system prompt for every document generation request, ensuring consistent behavior across all document types.

## Related Topics

- [Document Generation](../08-document-generation/edge-functions.md) -- Edge Function implementation details
- [Generated Documents](../24-generated-documents/gen-docs.md) -- Document storage and retrieval
- [AI Tracking](../10-ai-tracking/tracking.md) -- Token usage and cost tracking
