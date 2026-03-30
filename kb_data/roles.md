---
name: permissions-and-roles
description: Role-based access control, Supabase RLS policies, and project isolation
area: 19
maintained_by: permissions-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Permissions and Roles

## Overview

Workforce uses Role-Based Access Control (RBAC) with Supabase Row Level Security (RLS) for database-level enforcement.

## Authentication vs Authorization

| Concept | Description |
|---------|-------------|
| Authentication | Who the user is (login, session) |
| Authorization | What the user can do (permissions) |

## Role Hierarchy

| Role | Access Level |
|------|-------------|
| admin | Full project access, can manage team |
| member | Standard access, create/edit own resources |
| viewer | Read-only access |

## RLS Policies

Row Level Security enforces permissions at the database level.

### Example: Tasks Policy

```sql
-- Members can read tasks in their project
CREATE POLICY "Members can read tasks"
ON dev_tasks FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM team_members
    WHERE user_id = auth.uid()
  )
);

-- Members can insert tasks in their project
CREATE POLICY "Members can insert tasks"
ON dev_tasks FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id FROM team_members
    WHERE user_id = auth.uid()
  )
);
```

### Example: Documents Policy

```sql
-- Users can read documents in projects they belong to
CREATE POLICY "Users can read project documents"
ON generated_documents FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM team_members
    WHERE user_id = auth.uid()
  )
);
```

## Project-Level Isolation

All data is isolated by `project_id`:

```typescript
// Every query MUST include project_id
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProject?.id);
```

This ensures users only see data from projects they belong to.

## Frontend Permission Checks

```typescript
const { teamMembers, currentUser } = useTeam();

const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'member';

{
  canEdit && <EditButton />
}
```

## Related Topics

- [Authentication](../05-authentication/auth-flows.md)
- [Project Context](../06-project-context/context-system.md)
- [Team Members](../17-team-members/members.md)
