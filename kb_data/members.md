---
name: team-members
description: Team member profiles, associations, roles, and TeamContext
area: 17
maintained_by: team-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Team Members

## Overview

Team members are stored in the `team_members` table and managed via `TeamContext`.

## team_members Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Project association |
| user_id | UUID | Supabase Auth user ID |
| name | TEXT | Display name |
| email | TEXT | Email address |
| role | TEXT | Team role |
| created_at | TIMESTAMP | Creation timestamp |

## TeamContext

```typescript
const {
  teamMembers,      // All members of current team
  currentTeam,      // Current team object
  isLoading,       // Loading state
  error            // Error state
} = useTeam();
```

## Member Roles

Roles define permissions within a project:

| Role | Permissions |
|------|-------------|
| admin | Full access, can manage team |
| member | Standard access, can create/edit tasks |
| viewer | Read-only access |

## User Profile Management

Users can update their profile:

```typescript
const updateProfile = async (name: string, email: string) => {
  const { data, error } = await supabase
    .from('team_members')
    .update({ name, email })
    .eq('user_id', auth.user.id);

  if (error) throw error;
  return data;
};
```

## Related Topics

- [Permissions](../19-permissions/roles.md)
- [User Flows](../18-user-flows/flows.md)
- [Database Schema](../04-database-schema/schema.md)
