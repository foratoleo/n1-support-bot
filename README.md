# N1 Support Bot - Knowledge Base

This repository contains the knowledge base for the N1 Support Bot, a RAG-powered chatbot that assists users in validating potential issues in the workforce management system.

## Purpose

The N1 Support Bot analyzes user-reported issues through message-based validation without inspecting code or attempting automatic fixes. When validation suggests a genuine error, the bot escalates to human support.

## Knowledge Base Structure

```
kb_data/
  INDEX.md              # Knowledge base index
  overview.md           # System overview
  terms.md              # Key terms and definitions
  schema.md             # Database schema documentation
  structure.md          # Project structure

  # Foundation
  auth-flows.md         # Authentication flows
  context-system.md     # Context management system
  state-patterns.md     # State management patterns

  # Document Generation
  edge-functions.md     # Edge Functions architecture
  templates.md           # Document templates
  tracking.md            # AI interaction tracking
  endpoints.md          # API endpoints
  functions.md          # Supabase Functions
  views.md              # Database views

  # Frontend
  components.md         # UI components
  routes.md             # Routing system
  themes.md             # Area themes
  members.md            # Team members
  flows.md              # User flows
  permissions.md         # Roles and permissions

  # Planning
  projects.md           # Project management
  tasks.md             # Task management
  sprints.md           # Sprint planning
  transcripts.md       # Meeting transcripts
  gen-docs.md          # Document generation

  # Support
  validation.md         # Issue validation logic
  guides.md             # User guides
  bot.md               # Bot behavior and flows
```

## Tech Stack

- **Database**: PostgreSQL 15 with Supabase
- **Schema**: Custom `rag` schema for knowledge base
- **AI**: OpenAI GPT-4 for issue validation
- **Deployment**: Docker-based VPS setup

## Database Schema

The `rag` schema contains:

- `kb_documents` - Knowledge base articles
- `user_reports` - User-reported issues
- `conversations` - Chat conversations
- `escalations` - Human escalation records

## Related Repositories

- [workforce](https://github.com/foratoleo/workforce) - Main application

## License

Proprietary - All rights reserved
