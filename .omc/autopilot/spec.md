---
name: n1-support-bot-telegram
description: Telegram bot for N1 support using RAG knowledge base
area: phase-2
maintained_by: autopilot
created: 2026-03-30
updated: 2026-03-30
---

# N1 Support Bot - Telegram Integration Specification

## 1. Concept & Vision

A Telegram chatbot that serves as first-line (N1) support for the workforce management system. The bot receives user-reported issues, validates them through conversational questioning using a RAG knowledge base, and escalates confirmed bugs to human agents. The bot is a classifier and communicator -- it does NOT read code, access logs, or attempt fixes.

**Personality**: Professional, helpful, methodical. Asks clarifying questions before making decisions. Clear communication with structured responses.

## 2. System Architecture

```
User (Telegram) <--> Telegram Bot API <--> Bot Application
                                              |
                                              +--> RAG Knowledge Base (PostgreSQL)
                                              |
                                              +--> OpenAI API (GPT-4 for validation)
                                              |
                                              +--> Escalation Handler (stores to db)
```

## 3. Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Bot Framework | python-telegram-bot v21+ | Telegram Bot API wrapper |
| Runtime | Python 3.11+ | Application runtime |
| Database | PostgreSQL (rag schema) | RAG knowledge base storage |
| RAG | pgvector or keyword search | Similarity search for knowledge retrieval |
| LLM | OpenAI GPT-4o | Issue validation and response generation |
| Container | Docker + docker-compose | Deployment |

## 4. Database Schema (rag schema)

```sql
-- Knowledge base documents
CREATE TABLE rag.kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area TEXT NOT NULL,          -- foundation, document-generation, frontend, planning, support
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User issue reports
CREATE TABLE rag.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    project_id UUID,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, validating, resolved, escalated
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation history
CREATE TABLE rag.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_report_id UUID REFERENCES rag.user_reports(id),
    role TEXT NOT NULL,             -- user, bot
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Human escalations
CREATE TABLE rag.escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_report_id UUID REFERENCES rag.user_reports(id),
    summary TEXT NOT NULL,
    project_name TEXT,
    impact TEXT,
    assigned_to UUID,
    status TEXT DEFAULT 'open',     -- open, in_progress, resolved, closed
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 5. Bot Conversation Flow

```
1. User sends issue description
         |
         v
2. Bot acknowledges ("I've received your issue...")
         |
         v
3. Bot searches RAG knowledge base for relevant articles
         |
         v
4. Bot asks validation questions (1-3 questions based on issue category)
         |
         v
+---> Known issue found?
|       |
|      YES --> Provide self-service guide
|       |           |
|       |           v
|       |     Ask if resolved
|       |
|       NO
|       |
|       v
+---> Validated bug? --> YES --> Escalate to human
|       |
|       NO
|       |
|       v
   Provide explanation / close
```

## 6. Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and brief introduction |
| `/help` | Show available commands and FAQ |
| `/report <issue>` | Report an issue (shorthand for sending description) |
| `/status <report_id>` | Check status of a previous report |
| `/cancel` | Cancel current conversation |

## 7. Validation Question Patterns

### For Missing Data Issues
- "Which project are you working in?"
- "Can you confirm the data should exist in that project?"
- "Have you tried refreshing the page?"
- "What do you see when you look for the data?"

### For Document Generation Issues
- "Which transcript are you generating from?"
- "What document type did you select?"
- "Did you receive any error message?"
- "How long did you wait before it failed?"

### For Task/Sprint Issues
- "Which project and sprint is this task in?"
- "What status does the task currently show?"
- "Are you assigned as the task owner?"
- "Have you tried updating the task status?"

### For Login/Auth Issues
- "Are you seeing any error message?"
- "Have you tried clearing your browser cache?"
- "Can you try a different browser?"
- "Did your password recently change?"

## 8. Escalation Template

When the bot escalates to human:

```
I've analyzed your issue and identified a potential problem that requires human investigation.

Summary:
- Issue: [brief description]
- Project: [project name]
- Impact: [how it affects user]

I'm escalating this to our support team. A human agent will review and respond shortly.

Your report ID: [report_id]

In the meantime:
- [Optional: provide any temporary workaround]
- [Optional: suggest checking known issues]
```

## 9. Self-Service Guidance Template

```
I found information about this in our knowledge base.

[Summary of known issue and solution]

Steps to resolve:
1. [Step 1]
2. [Step 2]
3. [Step 3]

If this does not resolve your issue, please let me know and I will escalate to a human agent.
```

## 10. Project Structure

```
/Users/forato-dr/Desktop/projects/ragworkforce/
├── src/
│   ├── __init__.py
│   ├── main.py                 # Entry point
│   ├── bot.py                  # Telegram bot handlers
│   ├── config.py                # Configuration
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── knowledge_base.py    # KB search logic
│   │   └── embeddings.py       # Embedding generation
│   ├── validation/
│   │   ├── __init__.py
│   │   ├── classifier.py        # Issue classification
│   │   └── questions.py         # Validation question logic
│   ├── escalation/
│   │   ├── __init__.py
│   │   └── handler.py           # Escalation logic
│   ├── database/
│   │   ├── __init__.py
│   │   ├── connection.py        # PostgreSQL connection
│   │   └── models.py           # Data models
│   └── utils/
│       ├── __init__.py
│       └── logger.py           # Logging setup
├── tests/
│   ├── __init__.py
│   ├── test_bot.py
│   ├── test_rag.py
│   ├── test_validation.py
│   └── test_escalation.py
├── kb_data/                    # Knowledge base documents
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

## 11. Configuration (.env.example)

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/n1_support
RAG_SCHEMA=rag

# Optional
LOG_LEVEL=INFO
```

## 12. Acceptance Criteria

### Must Have
- [ ] Bot receives messages via Telegram
- [ ] Bot acknowledges every user message
- [ ] Bot searches knowledge base for relevant articles
- [ ] Bot asks validation questions based on issue category
- [ ] Bot provides self-service guidance for known issues
- [ ] Bot escalates to human when validation suggests bug
- [ ] Bot stores all conversations in database
- [ ] Bot tracks report status

### Should Have
- [ ] `/start` command with welcome message
- [ ] `/help` command with usage guide
- [ ] `/status` command to check report status
- [ ] Graceful error handling
- [ ] Logging of all interactions

### Could Have
- [ ] Multi-language support (PT-BR, EN-US)
- [ ] Report history per user
- [ ] Admin commands for escalation management

## 13. Escalation Criteria

Escalate to human when:
1. **Cannot reproduce** - Issue cannot be verified
2. **Data corruption** - Data appears lost or inconsistent
3. **Auth failure** - Login issues that persist after troubleshooting
4. **Generation failure** - Document generation fails with no clear cause
5. **Permission issue** - User cannot access what they should
6. **Repeated issue** - Same issue reported multiple times
7. **User requests** - User explicitly asks for human help

## 14. What NOT to Escalate

1. User errors (wrong project, wrong data interpretation)
2. Feature requests (not bugs)
3. Questions about how to use features
4. Known limitations already documented
5. Rate limiting (explain and wait)

## 15. Related Documents

- Knowledge base: `kb_data/` (28 articles covering workforce system)
- Bot behavior: `kb_data/bot.md`
- Validation rules: `kb_data/validation.md`
- Self-service guides: `kb_data/guides.md`
- Database schema: `kb_data/schema.md`
