---
name: validation-rules
description: Validation rules for bug reports - what makes a valid report, decision tree
area: 25
maintained_by: support-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Validation Rules for Bug Reports

## Overview

The N1 support bot validates incoming bug reports through structured conversation before taking any action. Validation is a filtering and gathering process -- it determines whether the reported issue is actionable, sufficient for diagnosis, or requires escalation. The bot does not read code, access databases, or attempt fixes. Validation is achieved entirely through message-based questioning and RAG knowledge base lookups.

These rules govern what the bot must check, what it must ask, and how it routes each report through the decision tree.

---

## What Constitutes a Valid Bug Report

A valid bug report contains enough information to determine whether the issue is a reproducible system defect, a user error, or a known limitation. The four required components are described below.

### 1. Observable Symptoms

The user must describe what they observed. Symptoms must be concrete and specific:

- **Good**: "After I click 'Generate Document', the page shows a loading spinner for 30 seconds and then displays an empty document."
- **Bad**: "Document generation does not work." (no details, no behavior described)

Required symptom fields:
- What the user attempted to do
- What the system did instead of the expected behavior
- Any visible error messages, codes, or UI states
- Whether the behavior is intermittent or consistent

### 2. Steps to Reproduce

The user must provide enough steps to allow the issue to be recreated. Not every report requires this -- some issues are one-time events -- but when the user can identify steps, they must be:

- Numbered and sequential
- Specific enough that another user in the same context would experience the same result
- Free of assumptions (do not assume the reviewer knows the workflow)

For document generation issues, reproduce steps should include:
- The project context (which project and workspace)
- The navigation path to the action
- The specific inputs provided
- Any error messages observed along the way

### 3. Expected vs. Actual Behavior

The user must distinguish between what they expected and what actually happened. This is the core of bug reporting -- without this distinction, the bot cannot determine whether the behavior is a defect or a misunderstanding.

Format:
- **Expected**: What should happen when the feature works correctly
- **Actual**: What happened instead, described objectively

Examples:
- Expected: "A PRD document should appear with content derived from the meeting transcript." Actual: "An empty document appears with no content."
- Expected: "The task should move to 'In Progress' after I click the status button." Actual: "The button does not respond and the task remains in 'To Do'."
- Expected: "My team members should appear in the project member list." Actual: "The member list is empty despite three members being added."

### 4. Context

Sufficient context must be present to reproduce or investigate the issue. Minimum context requirements:

- **Project**: Which project was being used when the issue occurred
- **Role**: The user's role (admin, team member, viewer) to assess permission-related issues
- **Timestamp**: When the issue began, including whether it is a new issue or has been occurring over time
- **Environment**: Browser and version, or whether the issue occurs in both normal and incognito modes
- **Frequency**: Is the issue reproducible every time or does it occur intermittently

---

## Validation Questions the Bot Should Ask

When any of the four required components (symptoms, steps, expected/actual behavior, or context) is missing, the bot must ask targeted probing questions to gather the missing information before proceeding.

### Probing Questions by Category

**Missing symptom description:**
- "Can you describe exactly what you see on the screen when the issue occurs?"
- "What happens after you click that button -- does anything change?"
- "Are there any error messages displayed? If so, what do they say?"

**Missing steps to reproduce:**
- "Could you walk me through the steps you took leading up to the issue, starting from when you opened the project?"
- "What did you click first, and what happened after each click?"
- "Can you reproduce this issue now, or did it happen only once?"

**Missing expected vs. actual distinction:**
- "When you say it 'does not work', what did you expect to happen versus what actually happened?"
- "What does the system show you now that is different from what it showed before?"
- "If the document was generated successfully, what content should it contain?"

**Missing context:**
- "Which project are you working in right now?"
- "What is your role on this project -- are you an admin or a team member?"
- "When did you first notice this issue -- was it working correctly before?"
- "Are you using Chrome, Firefox, Safari, or another browser?"
- "Does the issue still happen if you refresh the page or try in a private/incognito window?"

### Questioning Strategy

The bot should:
1. Ask one question at a time to avoid overwhelming the user
2. Use the user's prior response to frame the next question specifically
3. Stop asking follow-up questions once all four components are present
4. Confirm understanding by restating the report before proceeding to diagnosis

Example dialogue:
```
Bot: You mentioned the document is not showing content. Can you describe
what you see on the screen right now?

User: I see a blank white page after clicking 'Generate'. The loading
spinner appeared for about 20 seconds.

Bot: Thank you. What did you expect to see on that page instead of the
blank screen?

User: I expected the PRD template with sections populated from my meeting
transcript.

Bot: Got it. Which project and transcript are you working with? And were
you able to generate documents successfully in this project before?
```

---

## Known Error Patterns Users Commonly Report

The following patterns appear frequently in user reports and can be quickly identified through validation:

### Pattern 1: Misidentified Normal Behavior
Users report features as broken when the system is behaving correctly but differently than expected.

- "The document is empty" when the user has not yet populated meeting transcript content
- "I cannot see my team members" when the user is viewing a different project
- "The task status did not change" when the user does not have permission to update that status
- "AI generation is slow" when the system is processing a long transcript within normal latency bounds

**Bot response**: Explain the feature behavior clearly and confirm whether the user has met the prerequisites.

### Pattern 2: Cross-Project Confusion
Users report missing data that exists in a different project context.

- Documents visible in Project A but not in Project B
- Team members not appearing because the user is viewing the wrong project
- Sprint data missing because the user switched to a different workspace

**Bot response**: Ask which project the user is in, verify the data exists in that project specifically, and guide them to the correct context.

### Pattern 3: Stale Interface State
The UI does not reflect current database state due to missing or failed refresh.

- "My task is still in 'To Do' even though I updated it."
- "New members I added are not showing up."
- "The sprint I created does not appear in the list."

**Bot response**: Instruct the user to refresh the page (Ctrl+Shift+R or equivalent) and confirm whether the data appears after refresh.

### Pattern 4: Document Type Mismatch
Users select the wrong document type for their intent and report the output as broken.

- "User stories generated from meeting notes are not detailed enough" when the system correctly used a template designed for high-level stories
- "The technical spec is missing implementation steps" when the user selected the wrong template

**Bot response**: Confirm which document type was selected and explain what each template produces.

### Pattern 5: Permission-Based Errors
Users attempt actions that their role does not permit.

- Team members cannot create sprints (only admins can)
- Viewers cannot update task status
- Users in one project cannot access data from another project

**Bot response**: Explain the permission structure for the relevant action and confirm the user's role.

---

## Decision Tree: User Error vs. System Bug

The bot applies the following decision tree to classify each validated report:

```
Step 1: Gather Report
    |
    v
Does the report contain symptoms, expected/actual behavior, and context?
    |
    NO --> Ask probing questions until all four components are present
    |
    YES
    |
    v
Step 2: Check Against Known Error Patterns
    |
    v
Does the report match a known pattern (misidentified behavior, cross-project,
stale UI, permission error)?
    |
    YES --> Provide self-service guidance for the identified pattern
    |         Document the exchange. Close if resolved.
    |
    NO
    |
    v
Step 3: Check Against RAG Knowledge Base
    |
    v
Is there a matching entry in the RAG knowledge base with a known solution?
    |
    YES --> Provide the known solution as self-service guidance
    |         Confirm whether the solution resolves the issue.
    |
    NO
    |
    v
Step 4: Attempt to Classify
    |
    v
Can the issue be reproduced with the provided steps?
    |
    NO  --> Cannot classify as bug. Ask for more details or escalate.
    |
    YES
    |
    v
Is the reproduction behavior clearly a system defect
    (not a workflow issue, not a permission issue, not a data issue)?
    |
    YES --> Escalate to human agent as confirmed bug.
    |
    NO  --> Escalate to human agent with note: "Unclear classification,
             partial reproduction, or multiple factors involved."
```

### Classification Summary

| Classification | Criteria | Bot Action |
|---|---|---|
| User error | Report reflects misunderstanding of feature behavior or incorrect workflow | Provide explanation and guide to correct usage |
| Missing prerequisites | Report caused by incomplete setup (empty transcript, missing members) | Explain prerequisites and guide to completion |
| Stale UI state | Data exists but UI has not refreshed | Instruct to hard refresh |
| Permission issue | User attempts action their role does not permit | Explain permissions and role-based limits |
| Reproducible system defect | Steps produce consistent incorrect behavior | Escalate to human as confirmed bug |
| Cannot reproduce | Steps provided do not produce the reported issue | Ask for clarification, escalate if unresolved |
| Known issue | RAG KB contains matching issue and solution | Provide self-service guidance |

---

## When to Escalate to Human

The bot must escalate to a human agent in the following situations, without exception:

### Confirmed Bug
The issue is reproducible, the expected vs. actual behavior is clearly distinct, and the steps lead to a consistent incorrect result. The bot cannot determine the root cause or fix it -- it must escalate with a complete report.

**Escalation content required:**
- Full symptom description
- Steps to reproduce
- Expected and actual behavior
- Project context
- User role
- Frequency and timestamp
- Any RAG KB references already reviewed

### Data Loss or Corruption
Any report that indicates data is missing, deleted, or has become inconsistent. This includes:
- Documents that disappeared without user action
- Tasks or sprints that no longer appear in the list
- Member data that was present and is now absent
- Generated content that was saved and is no longer retrievable

**Note**: The bot does not verify data loss through database access. It must treat user reports of data loss as legitimate escalations unless there is clear evidence the user is in the wrong project context.

### Security Issue
Any report that suggests unauthorized access, data exposure, or permission bypass. Security issues must always be escalated immediately and should be flagged distinctly in the escalation template.

Examples:
- A user sees data from another project or team
- A user can access or modify content they should not have permission to
- Authentication is bypassed or tokens are exposed

### Authentication Failures That Persist After Troubleshooting
Login issues that continue after the standard troubleshooting steps (cache clear, incognito mode, password check) have been completed.

### Feature Gaps or Ambiguous Behavior
When no known pattern applies, the issue cannot be reproduced, and the behavior does not clearly match system intent -- the bot must escalate with full context rather than close the conversation.

### User Explicitly Requests Human Assistance
When the user asks to speak with a person, the bot should respect that request and escalate regardless of whether the issue appears resolvable through self-service.

---

## Escalation Threshold Summary

The bot escalates when ANY of the following is true:

- The issue is a reproducible system defect (confirmed bug)
- The user reports data loss or corruption
- The report suggests a security or permission vulnerability
- Authentication failures persist after standard troubleshooting
- The issue cannot be matched to any known pattern or RAG KB entry
- The issue cannot be reproduced with the provided steps
- The user explicitly requests human support
- The same issue has been reported multiple times by different users

The bot does NOT escalate when:
- The report matches a known error pattern with a clear self-service resolution
- The issue is clearly a user error (wrong project, missing prerequisites, incorrect workflow)
- The issue is a feature limitation already documented in the RAG KB
- The user simply does not know how to use a feature (explain the feature, do not escalate)

---

## Related Topics

- [N1 Bot Behavior](../28-n1-bot-behavior/bot.md) -- Bot responsibilities, non-responsibilities, and escalation format
- [Self-Service Guides](../26-self-service-guides/guides.md) -- Known issue resolutions for common patterns