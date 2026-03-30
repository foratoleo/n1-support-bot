---
name: database-schema
description: Complete database schema with tables, columns, relationships, RLS policies
area: 04
maintained_by: db-architect
created: 2026-03-30
updated: 2026-03-30
---

# Database Schema Reference

This document provides a comprehensive reference for the Workforce database schema. It covers all core tables, their columns, data types, relationships, and the Row-Level Security (RLS) policies that enforce project-based data isolation.

## Entity-Relationship Diagram

```
+---------------------------+       +---------------------------+       +---------------------------+
|   profiles                |       |   project_knowledge_base |       |   team_members            |
|---------------------------|       |---------------------------|       |---------------------------|
| id (PK) [uuid]            |<------| owner (FK profiles)       |       | id (PK) [uuid]            |
| email [text]              |       | id (PK) [uuid]            |------>| profile [text]            |
| full_name [text]          |       | name [text]                |       | status [text]             |
| avatar_url [text]        |       | description [text]        |       | name [text]               |
+---------------------------+       | category [text]           |       | email [text]              |
                                     | tags [text[]]             |       | headline [text]           |
                                     +---------------------------+       | bio [text]                 |
                                           |                         | professional_summary [text]|
                                           | 1:N                     | avatar_url [text]          |
                                           v                         +---------------------------+
+---------------------------+       +---------------------------+            | 1:N                |
|   sprints                 |       |   dev_tasks               |            v                |
|---------------------------|       |---------------------------|       +---------------------------+
| id (PK) [uuid]            |<------| project_id (FK pkb)       |       | project_team_members       |
| project_id (FK pkb)       |       | id (PK) [uuid]            |       |---------------------------|
| name [varchar]            |       | sprint_id (FK sprints)    |<------+ member_id (FK team_members)|
| status [sprint_status]   |       | assigned_to (FK team_memb)|       | project_id (FK pkb)        |
| start_date [date]        |       | parent_task_id (FK self)  |       | role [text]                |
| end_date [date]          |       | feature_id (FK features)   |       +---------------------------+
| velocity [numeric]        |       | status [task_status]      |       | team_member_skills          |
| planned_points [int]      |       | priority [task_priority]   |       | team_member_tools           |
| completed_points [int]   |       | title [text]               |       +---------------------------+
+---------------------------+       | description [text]        |
                                     | story_points [int]        |
                                     +---------------------------+
                                           |
                                           | 1:N
                                           v
+---------------------------+       +---------------------------+
|   meeting_transcripts     |       |   generated_documents     |
|---------------------------|       |---------------------------|
| id (PK) [uuid]            |<------| project_id (FK pkb)       |
| project_id (FK pkb)       |       | id (PK) [uuid]            |
| meeting_id (FK meetings)  |       | meeting_transcript_id(FK) |
| title [text]              |       | ai_interaction_id (FK)    |
| transcript_text [text]    |       | sprint_id (FK sprints)    |
| transcript_metadata[jsonb]|       | status [text]             |
| meeting_date [timestamp]  |       | document_type [text]      |
| tags [text[]]            |       | document_name [text]       |
| is_public [bool]          |       | content [text]            |
+---------------------------+       | version [int]             |
                                     | is_current_version [bool]  |
                                     | approved_by [uuid]        |
                                     | rejected_by [uuid]        |
                                     +---------------------------+
                                           |
                                           | N:1
                                           v
+---------------------------+
|   ai_interactions         |
|---------------------------|
| id (PK) [uuid]            |
| project_id (FK pkb)       |
| meeting_transcript_id(FK) |
| previous_interaction_id(FK)|
| interaction_type [text]  |
| status [text]             |
| request_prompt [text]     |
| response_text [text]      |
| request_model [text]      |
| cost_usd [numeric]        |
| token_usage [jsonb]       |
| duration_ms [int]         |
| quality_score [numeric]   |
| error_message [text]      |
| retry_count [int]         |
+---------------------------+
```

---

## 1. project_knowledge_base

The central table representing all projects in the system. All other core tables maintain a foreign key to this table, enabling strict project-based data isolation.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | null | Project display name |
| description | text | NO | null | Project description |
| category | text | YES | null | Project category or type |
| owner | uuid | YES | null | FK to profiles.id -- project owner |
| context_data | jsonb | YES | '{}'::jsonb | Flexible metadata storage |
| is_active | boolean | YES | true | Soft-delete flag |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |
| tags | text[] | YES | '{}'::text[] | Project tags for filtering |
| git_repository_url | text | YES | null | Linked Git repository URL |
| jira_url | text | YES | null | Linked Jira instance URL |
| logo_url | text | YES | null | Project logo image URL |
| icon | text | YES | null | Project icon identifier |
| color | text | YES | null | Project color theme |
| leaders_managers | jsonb | YES | '[]'::jsonb | Project leadership information |
| team_member_links | jsonb | YES | '[]'::jsonb | Team member associations |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |

### Relationships

- **owner** -> `profiles.id` (N:1, optional)
- **Referenced by**: All other core tables as the primary project isolation anchor

### RLS Policies

RLS is enforced so that users can only access project records they have been granted access to via `user_project_access`.

```sql
-- Project visibility: user must have a record in user_project_access
CREATE POLICY project_isolation_select ON project_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_project_access
      WHERE user_project_access.project_id = project_knowledge_base.id
      AND user_project_access.user_id = auth.uid()
      AND user_project_access.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `owner`
- Index on `is_active`
- Index on `deleted_at`

---

## 2. team_members

Represents individual team members within the system. Team members can be assigned to tasks and linked to projects through the `project_team_members` join table.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | null | Full name of the team member |
| email | text | YES | null | Email address |
| profile | text | NO | 'fullstack'::text | Professional profile/specialization |
| status | text | NO | 'active'::text | Member status: active, inactive |
| headline | text | YES | null | Short professional headline |
| bio | text | YES | null | Biography or description |
| professional_summary | text | YES | null | Detailed professional summary |
| avatar_url | text | YES | null | Profile picture URL |
| slug | text | NO | null | URL-friendly identifier |
| member_type | character varying | YES | 'human'::character varying | human or bot/agent |
| created_by | text | YES | null | Creator reference |
| created_at | timestamp with time zone | NO | now() | Creation timestamp |
| updated_at | timestamp with time zone | NO | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- Referenced by `dev_tasks.assigned_to`
- Referenced by `project_team_members.member_id`
- Join table `team_member_skills` (N:1 via team_member_id)
- Join table `team_member_tools` (N:1 via team_member_id)

### RLS Policies

Team members are visible across projects but must belong to a project to be used within that project's context.

```sql
-- Team members are globally visible but filtered by project context
CREATE POLICY team_members_project_filter ON team_members
  FOR SELECT USING (
    deleted_at IS NULL
  );
```

### Indexes

- Primary key on `id`
- Index on `email`
- Index on `status`
- Index on `slug` (unique)
- Index on `deleted_at`

---

## 3. dev_tasks

Represents individual tasks (also known as user stories, bugs, or features) within a project. Tasks can belong to sprints, be assigned to team members, and track time and progress.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| sprint_id | uuid | YES | null | FK to sprints.id -- sprint assignment |
| assigned_to | uuid | YES | null | FK to team_members.id -- assigned developer |
| parent_task_id | uuid | YES | null | FK to dev_tasks.id -- parent for subtasks |
| feature_id | uuid | YES | null | FK to features.id -- parent feature |
| status | task_status (enum) | NO | 'todo'::task_status | Current status |
| priority | task_priority (enum) | NO | 'medium'::task_priority | Task priority level |
| task_type | task_type (enum) | NO | 'feature'::task_type | Type: feature, bug, chore, spike |
| title | text | NO | null | Task title |
| description | text | YES | null | Detailed task description |
| story_points | integer | YES | 0 | Estimated story points |
| estimated_hours | integer | YES | 0 | Estimated hours |
| actual_hours | integer | YES | 0 | Actual hours spent |
| tags | text[] | YES | '{}'::text[] | Task tags |
| dependencies | jsonb | YES | '[]'::jsonb | Task dependency references |
| component_area | text | YES | null | Technical component or area |
| ai_metadata | jsonb | YES | '{}'::jsonb | AI-generated metadata |
| generated_from_interaction_id | uuid | YES | null | FK to ai_interactions.id -- source AI interaction |
| jira_sync_enabled | boolean | YES | false | Whether Jira sync is enabled |
| jira_issue_key | text | YES | null | Jira issue key |
| jira_issue_id | text | YES | null | Jira issue numeric ID |
| jira_sync_status | text | YES | null | Last sync status |
| jira_last_synced_at | timestamp with time zone | YES | null | Last Jira sync timestamp |
| last_jira_sync | timestamp with time zone | YES | null | Alternate last sync timestamp |
| created_by | text | YES | null | Creator reference |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `sprint_id` -> `sprints.id` (N:1, optional)
- `assigned_to` -> `team_members.id` (N:1, optional)
- `parent_task_id` -> `dev_tasks.id` (self-reference for subtasks)
- `feature_id` -> `features.id` (N:1, optional)
- `generated_from_interaction_id` -> `ai_interactions.id` (N:1, optional)
- Referenced by `task_comments.task_id`
- Referenced by `task_attachments.task_id`

### RLS Policies

Tasks are filtered by the current project context, enforced through the project_id column.

```sql
-- Tasks are isolated by project_id
CREATE POLICY tasks_project_isolation ON dev_tasks
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `sprint_id`
- Index on `assigned_to`
- Index on `status`
- Index on `priority`
- Index on `parent_task_id`
- Index on `deleted_at`
- Composite index on `(project_id, sprint_id)`
- Composite index on `(project_id, status)`

---

## 4. sprints

Represents time-boxed development iterations. Sprints belong to a project and track planned versus completed work through story points.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| name | character varying | NO | null | Sprint name |
| status | sprint_status (enum) | YES | 'planning'::sprint_status | Sprint status |
| start_date | date | NO | null | Sprint start date |
| end_date | date | NO | null | Sprint end date |
| goals | text[] | YES | ARRAY[]::text[] | Sprint goals |
| planned_points | integer | YES | null | Total planned story points |
| completed_points | integer | YES | null | Completed story points |
| velocity | numeric | YES | null | Calculated velocity (completed / duration) |
| description | text | YES | null | Sprint description |
| created_by | uuid | YES | null | FK to profiles.id -- sprint creator |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `created_by` -> `profiles.id` (N:1, optional)
- Referenced by `dev_tasks.sprint_id`
- Referenced by `generated_documents.sprint_id`
- Referenced by `meetings.sprint_id`
- Join table `feature_sprints` (many-to-many via features)

### RLS Policies

Sprints inherit project isolation from their project_id foreign key.

```sql
-- Sprints are isolated by project_id
CREATE POLICY sprints_project_isolation ON sprints
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `status`
- Index on `start_date`
- Index on `end_date`
- Index on `deleted_at`

---

## 5. meeting_transcripts

Stores transcribed content from meetings. Transcripts serve as input for AI-powered document generation (PRD, user stories, meeting notes, technical specs, test cases).

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| project_id | uuid | YES | null | FK to project_knowledge_base.id -- project isolation |
| meeting_id | uuid | YES | null | FK to meetings.id -- source meeting |
| title | text | NO | null | Transcript title |
| description | text | YES | null | Transcript description |
| transcript_text | text | NO | null | Full transcript content |
| transcript_metadata | jsonb | YES | '{}'::jsonb | Metadata such as speaker segments, timestamps |
| meeting_date | timestamp with time zone | NO | now() | Date and time of the meeting |
| tags | text[] | YES | '{}'::text[] | Tags for classification |
| is_public | boolean | YES | false | Whether transcript is publicly accessible |
| created_by | text | YES | null | Creator reference |
| created_at | timestamp with time zone | NO | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, optional -- project isolation)
- `meeting_id` -> `meetings.id` (N:1, optional)
- Referenced by `generated_documents.meeting_transcript_id`
- Referenced by `ai_interactions.meeting_transcript_id`
- Join table `feature_meetings` (many-to-many via features)

### RLS Policies

Transcripts are filtered by project_id, with optional public access override.

```sql
-- Transcripts are isolated by project_id or marked as public
CREATE POLICY transcripts_project_isolation ON meeting_transcripts
  FOR SELECT USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
    OR is_public = true
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `meeting_id`
- Index on `meeting_date`
- Index on `is_public`
- Index on `deleted_at`

---

## 6. generated_documents

Stores AI-generated documents such as PRDs, user stories, meeting notes, technical specs, and test cases. Documents are created from meeting transcripts via AI interactions.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| meeting_transcript_id | uuid | YES | null | FK to meeting_transcripts.id -- source transcript |
| ai_interaction_id | uuid | NO | null | FK to ai_interactions.id -- source AI interaction |
| sprint_id | uuid | YES | null | FK to sprints.id -- associated sprint |
| status | text | NO | 'draft'::text | Document status: draft, submitted, approved, rejected |
| document_type | text | YES | null | Type: prd, user-story, meeting-notes, technical-specs, test-cases |
| document_name | text | YES | null | Document display name |
| content | text | NO | null | Generated document content (Markdown) |
| raw_content | text | YES | null | Raw unprocessed content |
| content_format | text | YES | 'markdown'::text | Content format |
| version | integer | YES | 1 | Document version number |
| is_current_version | boolean | YES | true | Whether this is the current version |
| replaced_by | uuid | YES | null | FK to generated_documents.id -- replacement document |
| word_count | integer | YES | null | Word count of document content |
| section_count | integer | YES | null | Number of sections in the document |
| estimated_reading_time | integer | YES | null | Estimated reading time in minutes |
| quality_score | numeric | YES | null | AI-assessed quality score |
| quality_issues | text[] | YES | '{}'::text[] | List of identified quality issues |
| validation_results | jsonb | YES | '{}'::jsonb | Document validation results |
| company_knowledge_ids | jsonb | YES | '[]'::jsonb | Referenced company knowledge base entries |
| submitted_by | uuid | YES | null | User who submitted for approval |
| submitted_for_approval_at | timestamp with time zone | YES | null | Submission timestamp |
| approved_by | uuid | YES | null | User who approved the document |
| approved_at | timestamp with time zone | YES | null | Approval timestamp |
| approval_notes | text | YES | null | Approval notes |
| rejected_by | uuid | YES | null | User who rejected the document |
| rejected_at | timestamp with time zone | YES | null | Rejection timestamp |
| rejection_reason | text | YES | null | Reason for rejection |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional)
- `ai_interaction_id` -> `ai_interactions.id` (N:1, mandatory)
- `sprint_id` -> `sprints.id` (N:1, optional)
- `replaced_by` -> `generated_documents.id` (self-reference)
- Referenced by `feature_documents.document_id`

### RLS Policies

Documents are isolated by project_id and follow a workflow approval process.

```sql
-- Documents are isolated by project_id
CREATE POLICY documents_project_isolation ON generated_documents
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `meeting_transcript_id`
- Index on `ai_interaction_id`
- Index on `sprint_id`
- Index on `status`
- Index on `document_type`
- Index on `is_current_version`
- Index on `deleted_at`
- Composite index on `(project_id, document_type)`

---

## 7. ai_interactions

Tracks all AI interactions for token usage monitoring, cost tracking, and conversation continuity. Interactions are the building blocks for document generation and task creation.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| meeting_transcript_id | uuid | YES | null | FK to meeting_transcripts.id -- input source |
| previous_interaction_id | uuid | YES | null | FK to ai_interactions.id -- conversation chain |
| interaction_type | text | NO | null | Type: document-generation, task-creation, analysis |
| status | text | NO | 'pending'::text | Status: pending, in-progress, completed, failed |
| sequence_order | integer | NO | 1 | Order within a conversation sequence |
| request_prompt | text | YES | null | Original user prompt |
| response_text | text | YES | null | AI-generated response text |
| request_model | text | YES | null | OpenAI model used for request |
| cost_usd | numeric | YES | 0.00 | Calculated cost in USD |
| token_usage | jsonb | YES | '{}'::jsonb | Token usage breakdown (prompt, completion, total) |
| duration_ms | integer | YES | null | Interaction duration in milliseconds |
| quality_score | numeric | YES | null | Quality assessment score |
| quality_metrics | jsonb | YES | '{}'::jsonb | Detailed quality metrics |
| quality_issues | text[] | YES | '{}'::text[] | Identified quality issues |
| request_data | jsonb | YES | null | Full request payload |
| response_data | jsonb | YES | null | Full response payload |
| request_parameters | jsonb | YES | '{}'::jsonb | Request parameters (temperature, max_tokens, etc.) |
| response_metadata | jsonb | YES | '{}'::jsonb | Response metadata from OpenAI |
| openai_conversation_id | text | YES | null | OpenAI conversation ID for continuity |
| error_message | text | YES | null | Error message if interaction failed |
| error_details | jsonb | YES | null | Detailed error information |
| retry_count | integer | YES | 0 | Number of retry attempts |
| started_at | timestamp with time zone | YES | null | When the interaction started |
| completed_at | timestamp with time zone | YES | null | When the interaction completed |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional)
- `previous_interaction_id` -> `ai_interactions.id` (self-reference for conversation chains)
- Referenced by `generated_documents.ai_interaction_id`
- Referenced by `dev_tasks.generated_from_interaction_id`
- Referenced by `audit_trail.ai_interaction_id`
- Referenced by `external_service_calls.ai_interaction_id`

### RLS Policies

Interactions are isolated by project_id and track costs per project.

```sql
-- AI interactions are isolated by project_id
CREATE POLICY ai_interactions_project_isolation ON ai_interactions
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `meeting_transcript_id`
- Index on `previous_interaction_id`
- Index on `interaction_type`
- Index on `status`
- Index on `openai_conversation_id`
- Index on `created_at`
- Index on `deleted_at`
- Composite index on `(project_id, created_at)`

---

## Project ID Isolation Pattern

The project_id foreign key is the cornerstone of data isolation in the Workforce database. Every table that contains project-scoped data includes a `project_id` column referencing `project_knowledge_base.id`.

### Enforcement Rules

1. **Mandatory for scoped tables**: Tables like `dev_tasks`, `sprints`, and `generated_documents` require `project_id` to be non-null.
2. **Optional for cross-project tables**: Tables like `meeting_transcripts` and `team_members` allow null project_id for broader applicability.
3. **RLS enforcement**: Row-Level Security policies always check that the user's `user_project_access` record includes the target project_id.
4. **API layer enforcement**: The `useProjectSelection()` hook exposes `selectedProject?.id`, which must be included as `.eq('project_id', selectedProjectId)` in all Supabase queries.

### Query Pattern

```typescript
// CORRECT: Always filter by project_id
const { selectedProject } = useProjectSelection();
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .order('created_at', { ascending: false });

// INCORRECT: Never query without project context
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .order('created_at', { ascending: false }); // Missing project filter
```

---

## Enum Types

The schema uses three user-defined enum types:

| Enum | Values | Used By |
|------|--------|---------|
| task_status | todo, in_progress, done, blocked | dev_tasks.status |
| task_priority | low, medium, high, critical | dev_tasks.priority |
| task_type | feature, bug, chore, spike | dev_tasks.task_type |
| sprint_status | planning, active, completed, cancelled | sprints.status |
| feature_status | draft, planned, in_progress, delivered, archived | features.status |

---

## Supporting Tables

### project_team_members

Join table linking team members to projects with role information.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| id | bigint | NO | Primary key |
| project_id | uuid | NO | FK to project_knowledge_base.id |
| member_id | uuid | NO | FK to team_members.id |
| role | text | YES | Member's role within the project |
| joined_at | timestamp with time zone | NO | When member joined the project |
| created_at | timestamp with time zone | NO | Creation timestamp |
| updated_at | timestamp with time zone | NO | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | Soft-delete timestamp |

### task_comments

Discussion threads attached to tasks.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| id | uuid | NO | Primary key |
| task_id | uuid | NO | FK to dev_tasks.id |
| project_id | uuid | NO | FK to project_knowledge_base.id (isolation) |
| author_id | uuid | NO | FK to team_members.id |
| content | text | NO | Comment content |
| mentioned_members | jsonb | YES | Array of mentioned team member IDs |
| created_at | timestamp with time zone | YES | Creation timestamp |
| updated_at | timestamp with time zone | YES | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | Soft-delete timestamp |

### user_project_access

Controls which users can access which projects.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| id | bigint | NO | Primary key |
| user_id | uuid | NO | FK to profiles.id |
| project_id | uuid | NO | FK to project_knowledge_base.id |
| created_by | uuid | YES | FK to profiles.id -- who granted access |
| created_at | timestamp with time zone | NO | Grant timestamp |
| updated_at | timestamp with time zone | NO | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | Soft-delete timestamp |

---

## Index Strategy Summary

| Table | Primary Index | Key Composite Indexes | Foreign Key Indexes |
|-------|--------------|-----------------------|---------------------|
| project_knowledge_base | id | (owner) | - |
| team_members | id | (email), (slug) unique | - |
| dev_tasks | id | (project_id, sprint_id), (project_id, status) | project_id, sprint_id, assigned_to, parent_task_id |
| sprints | id | (project_id, status) | project_id |
| meeting_transcripts | id | (project_id, meeting_date) | project_id, meeting_id |
| generated_documents | id | (project_id, document_type) | project_id, meeting_transcript_id, ai_interaction_id, sprint_id |
| ai_interactions | id | (project_id, created_at) | project_id, meeting_transcript_id, previous_interaction_id |
| project_team_members | id | (project_id), (member_id) | project_id, member_id |
| task_comments | id | (task_id), (project_id) | task_id, project_id, author_id |
| user_project_access | id | (user_id), (project_id) | user_id, project_id |

---

## Design Principles

1. **Project isolation first**: Every query must include project context through project_id filtering, enforced at both the RLS and application layers.
2. **Soft deletes everywhere**: All tables include a `deleted_at` column for soft delete, never hard deletes.
3. **Audit capability**: The `audit_trail` table records all state changes across the system.
4. **AI cost tracking**: `ai_interactions` tracks every AI call with token usage and cost for project-level budgeting.
5. **Versioning for documents**: `generated_documents` supports version history through `version`, `is_current_version`, and `replaced_by` columns.
6. **Jira bidirectional sync**: `dev_tasks` supports optional Jira synchronization with local tracking of sync state.
7. **Flexible metadata**: JSONB columns (context_data, ai_metadata, transcript_metadata) allow structured but schema-less data storage.