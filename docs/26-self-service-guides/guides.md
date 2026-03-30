---
name: self-service-guides
description: User guidance for known issues, common problems, and resolution steps
area: 26
maintained_by: support-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Self-Service Guides

## Overview

Common issues and their resolution steps. Use these when the bot identifies a known problem.

## Authentication Issues

### Cannot Login

**Symptoms**: User cannot access the application

**Resolution**:
1. Verify email is correct (check for typos)
2. Verify password is correct (check caps lock)
3. Click "Forgot Password" if available
4. Clear browser cache and cookies
5. Try incognito/private browsing mode
6. Try a different browser

### Session Expired

**Symptoms**: Redirected to login during session

**Resolution**:
1. This is normal behavior after session timeout
2. Simply log in again
3. If frequent, check if browser is closing tabs

## Project Issues

### Wrong Project Selected

**Symptoms**: Cannot find expected data, tasks, or documents

**Resolution**:
1. Look at the top of the screen for project name
2. Click project selector (usually top-left or dropdown)
3. Select the correct project
4. Verify data now appears

### Cannot See Team Members

**Symptoms**: Team members list empty or missing people

**Resolution**:
1. Verify you are in the correct project
2. Ask project admin to add you to team_members
3. Check if user has accepted invitation

## Document Generation Issues

### Generation Taking Too Long

**Symptoms**: Document generation seems stuck

**Resolution**:
1. Wait up to 2 minutes for complex documents
2. Check if transcript content is very long
3. Refresh page and try again with shorter content
4. If persistent, escalate

### Generated Document is Empty or Wrong

**Symptoms**: Document created but has no content

**Resolution**:
1. Check source transcript has content
2. Verify transcript was saved properly
3. Try regenerating with a different transcript
4. If persistent, escalate with transcript ID

## Task Issues

### Cannot Create Task

**Symptoms**: Create task button missing or not working

**Resolution**:
1. Verify you are in correct project
2. Check your role (viewers cannot create)
3. Ask admin to check permissions
4. Verify sprint exists if required

### Task Status Not Updating

**Symptoms**: Changed task status but it reverted

**Resolution**:
1. Wait for page refresh
2. Clear browser cache
3. Check if you have edit permissions
4. Try refreshing the entire page

## Sprint Issues

### Sprint Not Showing Tasks

**Symptoms**: Sprint board is empty

**Resolution**:
1. Verify tasks have sprint_id set
2. Edit tasks to assign to sprint
3. Check if sprint is in correct project
4. Refresh page

## General Troubleshooting

### Page Not Loading

**Resolution**:
1. Refresh browser page (F5 or Cmd+R)
2. Clear browser cache
3. Try incognito/private mode
4. Check internet connection
5. Check Supabase status page

### Data Not Saving

**Resolution**:
1. Check for validation errors (red messages)
2. Verify required fields are filled
3. Wait for save to complete
4. Check for session timeout
5. Log out and back in

### Error Messages

| Message | Meaning | Action |
|---------|---------|--------|
| "Not authorized" | No permission | Contact admin |
| "Session expired" | Login required | Log in again |
| "Network error" | Connection issue | Check internet |
| "Something went wrong" | Unknown error | Refresh and retry |

## When to Escalate

Escalate to human when:
- Data appears corrupted or missing (not just hidden)
- Authentication fails after all troubleshooting
- Document generation fails with API errors
- Permission issues despite admin verification
- Same issue repeats after resolution steps
- User requests human assistance

## Related Topics

- [N1 Bot Behavior](../28-n1-bot-behavior/bot.md)
- [Validation Rules](../25-validation-rules/validation.md)
