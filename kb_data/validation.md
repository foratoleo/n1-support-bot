---
name: validation-rules
description: Valid bug report criteria, validation questions, decision tree, and escalation rules
area: 25
maintained_by: support-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Validation Rules

## Overview

This document defines how the N1 bot validates user-reported issues. The bot does NOT look at code or attempt fixes. It validates through message-based questioning.

## Valid Bug Report Criteria

A valid bug report should contain:

### 1. Clear Symptom Description
- What the user expected to happen
- What actually happened
- Clear, specific description

### 2. Steps to Reproduce (if applicable)
- Numbered list of steps
- Can be followed by others
- Leads to the same result

### 3. Context
- Which project was being used
- What action triggered the issue
- When it started happening

### 4. Impact
- How does this affect their work
- Is data lost or corrupted
- Is the issue blocking progress

## Validation Questions

The bot should ask these questions to validate:

### For Missing Data Issues
1. "Which project are you working in?"
2. "Can you confirm the data should exist in that project?"
3. "Have you tried refreshing the page?"
4. "What do you see when you look for the data?"

### For Document Generation Issues
1. "Which transcript are you generating from?"
2. "What document type did you select?"
3. "Did you receive any error message?"
4. "How long did you wait before it failed?"

### For Task/Sprint Issues
1. "Which project and sprint is this task in?"
2. "What status does the task currently show?"
3. "Are you assigned as the task owner?"
4. "Have you tried updating the task status?"

### For Login/Auth Issues
1. "Are you seeing any error message?"
2. "Have you tried clearing your browser cache?"
3. "Can you try a different browser?"
4. "Did your password recently change?"

## Decision Tree

```
User Reports Issue
        |
        v
    Ask clarifying questions
        |
        v
+---> Can reproduce with same steps?
|           |
|      YES  |  NO
|       v   |  v
|   Known   | Ask more context
|   Issue?  |     |
|       |   |     v
|      YES  | Check if user error
|       |   |     |
|       v   |  YES | NO
|   Provide |  v   v
|   self-   |Guide |Escalate
|   service |user  |to human
|   guide   |      |
+-----------+------+
        |
        v
   Escalate?
    YES -> Human Agent
```

## Escalation Criteria

Escalate to human when:

1. **Cannot reproduce** - Issue cannot be verified
2. **Data corruption** - Data appears lost or inconsistent
3. **Auth failure** - Login issues that persist after troubleshooting
4. **Generation failure** - Document generation fails with no clear cause
5. **Permission issue** - User cannot access what they should
6. **Repeated issue** - Same issue reported multiple times
7. **User requests** - User explicitly asks for human help

## What NOT to Escalate

1. User errors (wrong project, wrong data interpretation)
2. Feature requests (not bugs)
3. Questions about how to use features
4. Known limitations already documented
5. Rate limiting (explain and wait)

## Related Topics

- [N1 Bot Behavior](../28-n1-bot-behavior/bot.md)
- [Self-Service Guides](../26-self-service-guides/guides.md)
