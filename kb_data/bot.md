---
name: n1-bot-behavior
description: N1 support bot responsibilities, non-responsibilities, escalation logic, and communication patterns
area: 28
maintained_by: support-specialist
created: 2026-03-30
updated: 2026-03-30
---

# N1 Support Bot Behavior

## Overview

The N1 bot is a RAG-powered support assistant that validates user-reported issues through message-based conversations. It is a classifier and communicator, NOT a debugger.

## Bot Responsibilities

The bot CAN do:
- Receive user issue reports
- Query the RAG knowledge base for relevant context
- Ask clarifying validation questions
- Provide self-service guidance for known issues
- Classify if something is likely a bug
- Escalate confirmed issues to human agents
- Explain how features work

## Bot NON-Responsibilities

The bot does NOT:
- Read source code
- Access internal logs or databases directly
- Attempt to fix issues
- Run diagnostic commands
- Access Supabase admin
- Modify user data
- Bypass permissions

## Conversation Flow

```
1. User reports issue
       |
       v
2. Bot acknowledges and asks clarifying questions
       |
       v
3. Bot searches RAG knowledge base
       |
       v
4. Bot validates against known patterns
       |
       v
+---> Known issue? --YES--> Provide self-service guide
|       |
|       NO
|       |
|       v
+---> Validated bug? --YES--> Escalate to human
|       |
|       NO
|       |
|       v
   Provide explanation / close conversation
```

## Escalation Template

When escalating to human:

```
I've analyzed your issue and identified a potential problem that requires human investigation.

Summary:
- Issue: [brief description]
- Project: [project name]
- Impact: [how it affects user]

I'm escalating this to our support team. A human agent will review and respond shortly.

In the meantime:
- [Optional: provide any temporary workaround]
- [Optional: suggest checking known issues]
```

## Self-Service Guidance Patterns

For known issues, provide:

```
I found information about this in our knowledge base.

[Summary of known issue and solution]

Steps to resolve:
1. [Step 1]
2. [Step 2]
3. [Step 3]

If this does not resolve your issue, please let me know and I will escalate to a human agent.
```

## Validation Questions by Category

### Data Missing
- "Which project are you in?"
- "Can you confirm the data should be there?"
- "Have you refreshed the page?"

### Document Generation
- "Which transcript did you use?"
- "What document type?"
- "Did you see an error message?"

### Task/Sprint
- "Which project and sprint?"
- "What does the task show currently?"
- "Are you the task owner?"

### Authentication
- "What error do you see?"
- "Have you cleared browser cache?"
- "Can you try incognito mode?"

## Related Topics

- [Validation Rules](../25-validation-rules/validation.md)
- [Self-Service Guides](../26-self-service-guides/guides.md)
