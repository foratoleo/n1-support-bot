# N1 Support Bot - Implementation Plan

**Spec:** `.omc/autopilot/spec.md`
**Created:** 2026-03-30
**Updated:** 2026-03-30
**Tech Stack:** Python 3.11+ / python-telegram-bot v21+ / PostgreSQL (rag schema) / OpenAI GPT-4o / Docker

---

## 1. Project Overview

This plan covers the complete implementation of a Telegram chatbot that serves as first-line (N1) support for the workforce management system. The bot receives user-reported issues, validates them through conversational questioning using a RAG knowledge base, and escalates confirmed bugs to human agents.

### Bot Responsibilities (from spec)
- Receive and acknowledge user issue reports
- Search the RAG knowledge base for relevant articles
- Ask validation questions (1-3 questions based on issue category)
- Provide self-service guidance for known issues
- Escalate validated bugs to human agents
- Store all conversations in the database
- Track report status

### Bot NON-Responsibilities (from spec)
- Read source code or access internal logs
- Attempt to fix issues
- Access Supabase admin
- Modify user data or bypass permissions

---

## 2. Source Files to Create

### 2.1 Project Root Files

| File | Purpose | Priority |
|------|---------|----------|
| `src/__init__.py` | Package marker | P0 |
| `src/main.py` | Application entry point, bot initialization and long polling | P0 |
| `src/config.py` | Configuration loader from environment variables | P0 |
| `requirements.txt` | Python dependencies | P0 |
| `Dockerfile` | Container image for the bot | P0 |
| `docker-compose.yml` | Local development environment | P0 |
| `.env.example` | Environment variable template | P0 |
| `README.md` | Setup and usage documentation | P1 |
| `tests/__init__.py` | Test package marker | P0 |

### 2.2 Database Module (`src/database/`)

| File | Purpose | Key Functions / Classes |
|------|---------|-------------------------|
| `src/database/__init__.py` | Package marker | -- |
| `src/database/connection.py` | PostgreSQL connection pool and session management | `DatabasePool`, `get_db_session()`, `init_database()` |
| `src/database/models.py` | SQLAlchemy ORM models for rag schema tables | `KBDocument`, `UserReport`, `Conversation`, `Escalation` |
| `src/database/repositories.py` | Data access layer for all tables | `KBDocumentRepository`, `UserReportRepository`, `ConversationRepository`, `EscalationRepository` |

**Key Responsibilities of `connection.py`:**
- `DatabasePool` class: wraps `asyncpg` pool or `psycopg2` pool
- `get_db_session()`: context manager yielding a database session
- `init_database()`: creates rag schema if not exists, runs migrations
- Reads `DATABASE_URL` from env

**Key Responsibilities of `models.py`:**
- SQLAlchemy declarativeBase with 4 tables: `rag.kb_documents`, `rag.user_reports`, `rag.conversations`, `rag.escalations`
- Table definitions match the schema from `spec.md:43-83`
- All columns typed with UUID, Text, TIMESTAMPTZ as specified
- Proper foreign key relationships

**Key Responsibilities of `repositories.py`:**
- `KBDocumentRepository.search(query, area=None, limit=5)`: keyword/vector similarity search
- `KBDocumentRepository.get_by_id(doc_id)`: fetch single document
- `UserReportRepository.create(...)`: insert new report
- `UserReportRepository.update_status(report_id, status)`: update report status
- `UserReportRepository.get_by_id(report_id)`: fetch report with conversations
- `ConversationRepository.add_message(report_id, role, message)`: insert conversation message
- `EscalationRepository.create(...)`: insert escalation
- `EscalationRepository.get_by_report(report_id)`: fetch escalation for report

### 2.3 RAG Module (`src/rag/`)

| File | Purpose | Key Functions / Classes |
|------|---------|-------------------------|
| `src/rag/__init__.py` | Package marker | -- |
| `src/rag/knowledge_base.py` | Knowledge base search orchestration | `KnowledgeBaseSearcher`, `find_relevant_articles()`, `classify_issue_area()` |
| `src/rag/embeddings.py` | OpenAI embedding generation | `EmbeddingGenerator`, `generate_embedding()`, `batch_embed()` |

**Key Responsibilities of `knowledge_base.py`:**
- `KnowledgeBaseSearcher.__init__(db_pool)`: accepts database connection
- `find_relevant_articles(issue_description, area=None, limit=3)`: searches kb_documents by keyword similarity, returns list of `(title, content, area)` tuples
- `classify_issue_area(issue_description) -> str`: classifies issue into one of: `data_missing`, `document_generation`, `task_sprint`, `login_auth`, `general`
- Falls back to keyword matching if pgvector is not available (searches by `ILIKE` on title and content)
- Uses OpenAI `text-embedding-3-small` for vector search if pgvector is enabled

**Key Responsibilities of `embeddings.py`:**
- `EmbeddingGenerator.__init__(api_key)`: initializes OpenAI client
- `generate_embedding(text) -> list[float]`: generates embedding for a single text
- `batch_embed(texts) -> list[list[float]]`: generates embeddings for multiple texts with batching
- Reads `OPENAI_API_KEY` from env

### 2.4 Validation Module (`src/validation/`)

| File | Purpose | Key Functions / Classes |
|------|---------|-------------------------|
| `src/validation/__init__.py` | Package marker | -- |
| `src/validation/classifier.py` | Issue classification using GPT-4o | `IssueClassifier`, `classify()`, `should_escalate()` |
| `src/validation/questions.py` | Validation question generation and management | `QuestionGenerator`, `get_questions_for_category()`, `validate_responses()` |

**Key Responsibilities of `classifier.py`:**
- `IssueClassifier.__init__(openai_client, kb_searcher)`: accepts OpenAI client and KB searcher
- `classify(issue_description, context=None) -> IssueClassification`: returns `{ category, confidence, summary, area }`
- `should_escalate(issue_description, validation_answers, kb_articles) -> EscalationDecision`: determines if issue should be escalated
- Escalation criteria (from `spec.md:273-283`): cannot reproduce, data corruption, auth failure, generation failure, permission issue, repeated issue, user requests
- NOT escalate (from `spec.md:284-290`): user errors, feature requests, how-to questions, known limitations, rate limiting
- Calls GPT-4o with structured prompt using the conversation context

**Key Responsibilities of `questions.py`:**
- `QuestionGenerator.__init__(category)`: initializes for a specific issue category
- `get_questions_for_category(category) -> list[Question]`: returns 1-3 questions based on category
  - `data_missing`: project confirmation, data existence, page refresh, visible data
  - `document_generation`: transcript, document type, error message, wait time
  - `task_sprint`: project/sprint, task status, ownership, status update
  - `login_auth`: error message, browser cache, incognito mode, password change
- `validate_responses(questions, answers) -> ValidationResult`: returns `{ is_valid, is_known_issue, needs_escalation, summary }`
- Questions are stored as data structures, not hardcoded strings (for i18n readiness)

### 2.5 Escalation Module (`src/escalation/`)

| File | Purpose | Key Functions / Classes |
|------|---------|-------------------------|
| `src/escalation/__init__.py` | Package marker | -- |
| `src/escalation/handler.py` | Escalation creation and management | `EscalationHandler`, `create_escalation()`, `format_escalation_message()` |

**Key Responsibilities of `handler.py`:**
- `EscalationHandler.__init__(db_repo)`: accepts escalation repository
- `create_escalation(report_id, summary, project_name=None, impact=None) -> Escalation`: creates escalation record in DB, sets report status to `escalated`
- `format_escalation_message(escalation) -> str`: formats escalation using template from `spec.md:157-174`
- `format_self_service_message(article, guide_steps) -> str`: formats self-service guidance using template from `spec.md:178-189`
- `get_escalation_status(report_id) -> EscalationStatus`: fetches escalation status for `/status` command

### 2.6 Bot Module (`src/bot/`)

| File | Purpose | Key Functions / Classes |
|------|---------|-------------------------|
| `src/bot/__init__.py` | Package marker | -- |
| `src/bot/handlers.py` | Telegram message and command handlers | `register_handlers()`, `handle_message()`, `handle_command()` |
| `src/bot/conversation_manager.py` | Manages per-user conversation state | `ConversationManager`, `get_user_state()`, `update_user_state()`, `clear_user_state()` |
| `src/bot/templates.py` | Bot response templates and i18n | `BOT_MESSAGES`, `get_message()`, `format_acknowledge()`, `format_escalation()`, `format_self_service()` |
| `src/bot/commands.py` | Bot command definitions and router | `register_commands()`, `route_command()` |

**Key Responsibilities of `handlers.py`:**
- `register_handlers(application)`: registers all command and message handlers on the PTB Application
- `start_command(update, context)`: handles `/start` -- welcome message (template: `spec.md:119`)
- `help_command(update, context)`: handles `/help` -- usage guide
- `report_command(update, context)`: handles `/report <issue>` -- shorthand for sending description
- `status_command(update, context)`: handles `/status <report_id>` -- check report status
- `cancel_command(update, context)`: handles `/cancel` -- cancel current conversation
- `handle_message(update, context)`: main message handler -- orchestrates full flow:
  1. Acknowledge message (`BOT_MESSAGES["acknowledge"]`)
  2. Search KB for relevant articles
  3. Classify issue using GPT-4o
  4. Generate and ask validation questions
  5. Collect answers and validate
  6. If known issue -> provide self-service guide
  7. If validated bug -> create escalation
  8. If user error -> provide explanation and close
  9. Store all messages in `conversations` table

**Key Responsibilities of `conversation_manager.py`:**
- `ConversationManager.__init__()`: in-memory state store (dict) + optional Redis persistence
- `get_user_state(user_id) -> UserConversationState`: returns current state for user
  - States: `idle`, `awaiting_report`, `awaiting_validation_answer`, `providing_guidance`, `escalated`
- `update_user_state(user_id, state, data)`: updates user state and metadata (current report_id, current question index, etc.)
- `clear_user_state(user_id)`: resets to idle, clears all conversation data
- State data includes: `current_report_id`, `issue_description`, `classified_category`, `validation_questions`, `validation_answers`, `kb_articles_found`, `escalation_id`

**Key Responsibilities of `templates.py`:**
- `BOT_MESSAGES`: dict of all bot response strings
- `get_message(key, **kwargs) -> str`: retrieves and formats message
- `format_acknowledge(report_id) -> str`: "I've received your issue... Your report ID is: {report_id}"
- `format_escalation(summary, project, impact, workarounds) -> str`: escalation template per `spec.md:157-174`
- `format_self_service(summary, steps) -> str`: self-service template per `spec.md:178-189`
- `format_validation_question(question_number, total, question_text) -> str`
- `format_status_report(report_id, status, created_at) -> str`
- All messages in English by default, structured for i18n (Portuguese can be added later)

### 2.7 Utils Module (`src/utils/`)

| File | Purpose | Key Functions / Classes |
|------|---------|-------------------------|
| `src/utils/__init__.py` | Package marker | -- |
| `src/utils/logger.py` | Structured logging setup | `setup_logger()`, `get_logger()` |
| `src/utils/openai_client.py` | OpenAI client wrapper | `OpenAIClient`, `chat_completion()`, `structured_completion()` |
| `src/utils/sanitizer.py` | Input sanitization | `sanitize_user_input()`, `strip_html()` |

**Key Responsibilities of `logger.py`:**
- `setup_logger(name, level=None) -> logging.Logger`: configures structured logger with JSON output in production
- Logs: all incoming messages, KB search results, classification decisions, escalation events, errors
- Reads `LOG_LEVEL` from env (default: `INFO`)

**Key Responsibilities of `openai_client.py`:**
- `OpenAIClient.__init__(api_key, model="gpt-4o")`: initializes OpenAI client
- `chat_completion(messages, **kwargs) -> str`: sends chat completion request, returns text
- `structured_completion(system_prompt, user_message, schema) -> dict`: sends completion with JSON schema, returns parsed dict (used for classification)
- Handles rate limits, timeouts, and retries with exponential backoff

---

## 3. Test Files to Create

### 3.1 Unit Tests

| File | Tests | Coverage |
|------|-------|----------|
| `tests/__init__.py` | -- | -- |
| `tests/test_models.py` | SQLAlchemy model CRUD, serialization | `src/database/models.py` |
| `tests/test_repositories.py` | Repository methods with mocked DB | `src/database/repositories.py` |
| `tests/test_knowledge_base.py` | KB search, classification | `src/rag/knowledge_base.py` |
| `tests/test_embeddings.py` | Embedding generation, batching | `src/rag/embeddings.py` |
| `tests/test_classifier.py` | Issue classification, escalation decisions | `src/validation/classifier.py` |
| `tests/test_questions.py` | Question generation, validation | `src/validation/questions.py` |
| `tests/test_conversation_manager.py` | State transitions, data persistence | `src/bot/conversation_manager.py` |
| `tests/test_templates.py` | Message formatting, template rendering | `src/bot/templates.py` |
| `tests/test_escalation_handler.py` | Escalation creation, message formatting | `src/escalation/handler.py` |
| `tests/test_openai_client.py` | API calls, error handling, retries | `src/utils/openai_client.py` |

### 3.2 Integration Tests

| File | Tests | Scope |
|------|-------|-------|
| `tests/integration/__init__.py` | -- | -- |
| `tests/integration/test_bot_flow.py` | Full conversation flows via PTB test framework | Bot handlers + all modules |
| `tests/integration/test_rag_search.py` | KB search with real DB | `src/rag/` + database |
| `tests/integration/test_escalation_flow.py` | End-to-end escalation creation | All modules |

### 3.3 Test Infrastructure

| File | Purpose |
|------|---------|
| `tests/conftest.py` | Pytest fixtures: mock DB, mock OpenAI, test data factories |
| `tests/mocks.py` | Mock classes for external dependencies (OpenAI, DB) |

**Total target: 30+ unit tests, 10+ integration tests**

---

## 4. Configuration Files

### 4.1 `requirements.txt`

```
# Core
python-telegram-bot==21.7
openai>=1.80.0
psycopg2-binary>=2.9.10
sqlalchemy>=2.0.40
asyncpg>=0.30.0

# Utilities
python-dotenv>=1.0.1
pydantic>=2.10.0
httpx>=0.28.0

# Testing
pytest>=8.3.0
pytest-asyncio>=0.25.0
pytest-cov>=6.0.0
pytest-mock>=3.14.0

# Optional
redis>=5.2.0  # For conversation state persistence (if needed)
pgvector>=0.3.0  # For vector similarity search
```

### 4.2 `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN useradd -m telegram_bot && chown -R telegram_bot:telegram_bot /app
USER telegram_bot

CMD ["python", "-m", "src.main"]
```

### 4.3 `docker-compose.yml`

Extends the existing `docker-compose.yml` from `ragworkforce/` with the bot service:

```yaml
services:
  # ... existing db, postgrest, gotrue, meta services ...

  n1-support-bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: n1-support-bot
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DATABASE_URL: postgresql://postgres:postgres@db:5432/n1_support
      RAG_SCHEMA: rag
      LOG_LEVEL: INFO
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    profiles:
      - bot

networks:
  default:
    name: n1-support-network
```

### 4.4 `.env.example`

```
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key_here

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/n1_support
RAG_SCHEMA=rag

# Optional
LOG_LEVEL=INFO
USE_PGVECTOR=false
OPENAI_MODEL=gpt-4o
```

---

## 5. Database Migration Steps

### Phase 1: Create rag Schema and Tables

Run against the PostgreSQL instance defined in `docker-compose.yml`:

```sql
-- Migration 001: Create rag schema
CREATE SCHEMA IF NOT EXISTS rag;

-- Migration 002: Create kb_documents table
CREATE TABLE rag.kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area TEXT NOT NULL,  -- foundation, document-generation, frontend, planning, support
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration 003: Create user_reports table
CREATE TABLE rag.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    project_id UUID,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'resolved', 'escalated')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration 004: Create conversations table
CREATE TABLE rag.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_report_id UUID REFERENCES rag.user_reports(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration 005: Create escalations table
CREATE TABLE rag.escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_report_id UUID REFERENCES rag.user_reports(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    project_name TEXT,
    impact TEXT,
    assigned_to UUID,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration 006: Create indexes
CREATE INDEX idx_kb_documents_area ON rag.kb_documents(area);
CREATE INDEX idx_kb_documents_content_fts ON rag.kb_documents USING gin(to_tsvector('portuguese', content));
CREATE INDEX idx_user_reports_status ON rag.user_reports(status);
CREATE INDEX idx_user_reports_user_id ON rag.user_reports(user_id);
CREATE INDEX idx_conversations_report_id ON rag.conversations(user_report_id);
CREATE INDEX idx_escalations_status ON rag.escalations(status);
CREATE INDEX idx_escalations_report_id ON rag.escalations(user_report_id);
```

### Phase 2: Seed Knowledge Base from kb_data/

Create a migration script `migrations/seed_kb_from_kb_data.py` that:

1. Reads all `.md` files from `kb_data/`
2. Extracts frontmatter `area` field
3. Loads content into `rag.kb_documents` with `file_path` set to source file
4. Runs once on deployment

### Phase 3: Optional pgvector Setup

If `USE_PGVECTOR=true`:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE rag.kb_documents ADD COLUMN embedding vector(1536);
CREATE INDEX idx_kb_documents_embedding ON rag.kb_documents USING ivfflat(embedding vector_cosine_ops);
```

---

## 6. Step-by-Step Implementation Order

### Phase 1: Foundation (Day 1)

**Step 1:** Create project structure and configuration files
- `requirements.txt`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `src/__init__.py`, `src/config.py`, `src/utils/__init__.py`, `src/utils/logger.py`

**Step 2:** Implement database layer
- `src/database/__init__.py`
- `src/database/connection.py` -- DB pool and connection
- `src/database/models.py` -- SQLAlchemy models for all 4 tables
- `src/database/repositories.py` -- Repository classes
- `tests/test_models.py`, `tests/test_repositories.py`

**Step 3:** Run database migrations
- Execute SQL from Section 5
- Verify tables created correctly

**Step 4:** Implement RAG module
- `src/rag/__init__.py`
- `src/rag/embeddings.py` -- OpenAI embedding generation
- `src/rag/knowledge_base.py` -- KB search (keyword fallback + pgvector optional)
- `tests/test_embeddings.py`, `tests/test_knowledge_base.py`

### Phase 2: Intelligence (Day 2)

**Step 5:** Implement OpenAI utilities
- `src/utils/__init__.py` (update)
- `src/utils/openai_client.py` -- OpenAI client wrapper
- `src/utils/sanitizer.py` -- Input sanitization
- `tests/test_openai_client.py`

**Step 6:** Implement validation module
- `src/validation/__init__.py`
- `src/validation/classifier.py` -- GPT-4o issue classification and escalation decisions
- `src/validation/questions.py` -- Question generation and response validation
- `tests/test_classifier.py`, `tests/test_questions.py`

**Step 7:** Implement escalation module
- `src/escalation/__init__.py`
- `src/escalation/handler.py` -- Escalation creation and formatting
- `tests/test_escalation_handler.py`

### Phase 3: Bot Core (Day 3)

**Step 8:** Implement bot module
- `src/bot/__init__.py`
- `src/bot/templates.py` -- All response templates
- `src/bot/conversation_manager.py` -- Per-user state machine
- `tests/test_conversation_manager.py`, `tests/test_templates.py`

**Step 9:** Implement bot handlers
- `src/bot/handlers.py` -- All command and message handlers
- `src/bot/commands.py` -- Command routing
- `tests/integration/test_bot_flow.py`

### Phase 4: Integration (Day 4)

**Step 10:** Wire everything together
- `src/main.py` -- Application entry point, initializes all components, starts polling
- Integration test: `tests/integration/test_rag_search.py`, `tests/integration/test_escalation_flow.py`

**Step 11:** Seed knowledge base
- Run `migrations/seed_kb_from_kb_data.py` to populate `rag.kb_documents`

**Step 12:** Documentation
- `README.md` with setup instructions, environment variables, deployment steps

---

## 7. Dependencies Between Components

```
config.py (env loading)
    |
    +-- logger.py (logging)
    |
    +-- connection.py (DB pool)
    |       |
    |       +-- models.py (ORM definitions)
    |       |
    |       +-- repositories.py (data access)
    |               |
    |               +-- knowledge_base.py (KB search)
    |               |
    |               +-- escalation/handler.py (escalations)
    |
    +-- openai_client.py (GPT-4o)
    |       |
    |       +-- embeddings.py (vector generation)
    |       |
    |       +-- classifier.py (issue classification)
    |
    +-- conversation_manager.py (state machine)
    |       |
    |       +-- handlers.py (Telegram handlers)
    |               |
    |               +-- templates.py (response formatting)
    |
    +-- questions.py (validation questions)
            |
            +-- classifier.py (validation logic)
```

**Dependency Graph Summary:**

| File | Depends On | Used By |
|------|-----------|---------|
| `config.py` | -- | All modules |
| `logger.py` | `config.py` | All modules |
| `connection.py` | `config.py`, `logger.py` | `repositories.py`, `main.py` |
| `models.py` | `connection.py` | `repositories.py` |
| `repositories.py` | `models.py`, `connection.py` | `knowledge_base.py`, `escalation/handler.py`, `handlers.py` |
| `openai_client.py` | `config.py`, `logger.py` | `embeddings.py`, `classifier.py` |
| `embeddings.py` | `openai_client.py` | `knowledge_base.py` |
| `knowledge_base.py` | `repositories.py`, `embeddings.py` | `classifier.py`, `handlers.py` |
| `classifier.py` | `openai_client.py`, `knowledge_base.py` | `handlers.py` |
| `questions.py` | -- | `handlers.py` |
| `conversation_manager.py` | `logger.py` | `handlers.py` |
| `templates.py` | `escalation/handler.py` | `handlers.py` |
| `handlers.py` | All above | `main.py` |
| `main.py` | `config.py`, `logger.py`, `handlers.py`, `conversation_manager.py` | -- |

---

## 8. Key Design Decisions

### Decision 1: python-telegram-bot v21 (async) vs v20 (sync)

**Chosen:** v21 (async) -- aligns with modern Python patterns and enables non-blocking DB calls within handlers.

### Decision 2: SQLAlchemy 2.0 (async) vs sync

**Chosen:** SQLAlchemy 2.0 with `asyncpg` async driver -- enables non-blocking DB operations in async handlers. Fallback to sync `psycopg2-binary` if async pool fails.

### Decision 3: In-memory vs Redis for conversation state

**Chosen:** In-memory dict with optional Redis -- for initial implementation, use in-memory `ConversationManager` (sufficient for single-instance deployment). Redis persistence can be added as an optional enhancement via the `REDIS_URL` env var.

### Decision 4: pgvector vs keyword search

**Chosen:** Keyword search (tsvector) as default, pgvector as optional -- avoids adding pgvector dependency for initial deployment. The `kb_data/` files are structured markdown where keyword matching performs well. Set `USE_PGVECTOR=true` and add the `pgvector` extension to enable semantic search.

### Decision 5: Embedding model

**Chosen:** `text-embedding-3-small` -- 1536 dimensions, cost-effective, good quality for knowledge base retrieval.

### Decision 6: Classification model

**Chosen:** `gpt-4o` -- used for structured classification decisions (category, escalation). Fallback to `gpt-4o-mini` if cost is a concern via `OPENAI_MODEL` env var.

---

## 9. Acceptance Criteria Checklist

### Must Have (P0)
- [ ] Bot receives messages via Telegram
- [ ] Bot acknowledges every user message
- [ ] Bot searches knowledge base for relevant articles
- [ ] Bot asks validation questions based on issue category
- [ ] Bot provides self-service guidance for known issues
- [ ] Bot escalates to human when validation suggests bug
- [ ] Bot stores all conversations in database
- [ ] Bot tracks report status

### Should Have (P1)
- [ ] `/start` command with welcome message
- [ ] `/help` command with usage guide
- [ ] `/status` command to check report status
- [ ] Graceful error handling
- [ ] Logging of all interactions

### Could Have (P2)
- [ ] Multi-language support (PT-BR, EN-US)
- [ ] Report history per user
- [ ] Admin commands for escalation management

---

## 10. File Inventory Summary

| Category | Count | Total LOC (est.) |
|----------|-------|-----------------|
| Source files | 16 | ~2,500 |
| Test files | 11 | ~1,500 |
| Config files | 4 | ~100 |
| Docs | 1 | ~200 |
| **Total** | **32** | **~4,300** |

---

## 11. Migration Script

**File:** `migrations/seed_kb_from_kb_data.py`

```python
"""
Seed knowledge base from kb_data/ markdown files.

Reads all .md files from kb_data/, extracts frontmatter area,
and inserts into rag.kb_documents.

Usage: python migrations/seed_kb_from_kb_data.py
"""
# Implementation steps:
# 1. Walk kb_data/ directory for .md files
# 2. Parse frontmatter (area) and content from each file
# 3. Insert/update rag.kb_documents with file_path as unique key
# 4. Log progress and summary
```

---

## 12. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | -- | Telegram bot API token from @BotFather |
| `OPENAI_API_KEY` | Yes | -- | OpenAI API key |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `RAG_SCHEMA` | No | `rag` | PostgreSQL schema name |
| `LOG_LEVEL` | No | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `USE_PGVECTOR` | No | `false` | Enable pgvector semantic search |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model for classification |
| `REDIS_URL` | No | -- | Redis URL for state persistence (optional) |

---

## 13. Deployment Checklist

1. Create Telegram bot via @BotFather, obtain token
2. Set environment variables in production (Telegram token, OpenAI key, DATABASE_URL)
3. Run database migrations (Section 5)
4. Seed knowledge base from `kb_data/` (Step 11)
5. Build and start Docker container: `docker compose up -d --profile bot`
6. Verify bot responds to `/start` command
7. Test full conversation flow end-to-end
8. Configure monitoring/logging destination for production

