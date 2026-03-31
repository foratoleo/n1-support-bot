# External Integrations - RAG Workforce Project

**Last Updated:** 2026-03-30
**Created:** 2026-03-30

## Overview
This document maps all external services, APIs, databases, authentication providers, and webhooks integrated with the N1 Support Bot.

---

## External APIs

### 1. Telegram Bot API
**Service:** Telegram (Cloud-based messaging platform)
**Integration Type:** WebSocket polling
**Endpoint:** Handled via `python-telegram-bot` library
**Features Used:**
- Bot token authentication
- Update polling (drop_pending_updates=True)
- Message handlers
- Inline keyboard callbacks
- Command routing

**Configuration:**
```env
TELEGRAM_BOT_TOKEN=<bot_token_from_botfather>
```

**Code Location:** `src/bot/handlers.py`, `src/main.py`
**Implementation Pattern:** 
- Application builder: `Application.builder().token(TELEGRAM_BOT_TOKEN)`
- Polling: `await application.updater.start_polling()`
- Handlers registered via `register_handlers()`

**Commands Implemented:**
- `/start` - Welcome message
- `/help` - Command help
- `/report <issue>` - Submit issue report
- `/status <report_id>` - Check report status
- `/search <query>` - Knowledge base search
- `/list` - List user's reports
- `/feedback <report_id> <1-5>` - Rate resolution
- `/cancel` - Cancel current interaction

---

### 2. OpenAI API (with MiniMax Compatibility)
**Service:** OpenAI-compatible LLM provider (currently MiniMax)
**Primary Model:** MiniMax-M2 (OpenAI-compatible)
**Fallback Model:** gpt-4o (OpenAI native)

**Configuration:**
```env
OPENAI_API_KEY=<api_key>
OPENAI_MODEL=MiniMax-M2          # Default
OPENAI_BASE_URL=https://api.minimax.io/v1  # Default (MiniMax)
```

**Capabilities:**
1. **Chat Completions:**
   - Method: `OpenAIClient.chat_completion(messages, temperature)`
   - Used for: Response generation, issue analysis
   - Location: `src/utils/openai_client.py`

2. **Structured Responses:**
   - Method: `OpenAIClient.structured_completion(system_prompt, user_message, response_schema)`
   - JSON mode support for structured output
   - Temperature: 0.3 (deterministic)

3. **Text Embeddings:**
   - Model: text-embedding-3-small
   - Used for: RAG vector search and semantic similarity
   - Location: `src/rag/embeddings.py`
   - Method: `EmbeddingGenerator.generate_embedding()`, `batch_embed()`

**Code Locations:**
- Client: `src/utils/openai_client.py`
- Embeddings: `src/rag/embeddings.py`
- Usage: `src/rag/knowledge_base.py`, `src/validation/classifier.py`

**Rate Limiting & Error Handling:**
- Exception catching for API errors
- Logging with `logger.error()`
- No retry logic implemented (caller responsibility)

---

## Databases

### 1. PostgreSQL
**Type:** Relational Database
**Version:** 15-alpine (Docker), 12+ (local)
**Service Name:** `db` (Docker Compose)
**Port:** 5432
**Default Credentials:**
```env
Database: n1_support
User: postgres
Password: postgres
Host: localhost (local) or db (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/n1_support
```

**Async Driver:** asyncpg (primary), psycopg2-binary (fallback)
**Async URL Format:**
```
postgresql+asyncpg://postgres:postgres@localhost:5432/n1_support
```

**Schemas:**
- `rag` - Custom schema for bot tables
- `public` - Default schema (used by GoTrue, PostgREST metadata)

**Tables in `rag` Schema:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `kb_documents` | Knowledge base articles | id (UUID), area, title, content, file_path, created_at |
| `user_reports` | User issue submissions | id, user_id, project_id, description, status, rating, created_at |
| `conversations` | Message history | id, user_id, report_id, role, content, created_at |
| `escalations` | Escalated issues | id, user_report_id, summary, project_name, impact, assigned_to, status, created_at |

**Connection Management:**
- Async Pool: `DatabasePool` class in `src/database/connection.py`
- Pool Size: 10 connections
- Max Overflow: 20 additional connections
- Pool Recycling: 3600 seconds
- Health Check: pool_pre_ping=True

**Code Locations:**
- Pool: `src/database/connection.py`
- Models: `src/database/models.py`
- Repositories: `src/database/repositories.py`
- Init Script: `supabase/init.sql`

---

### 2. Vector Storage (Optional)
**Extension:** pgvector
**Status:** Installed but DISABLED by default (USE_PGVECTOR=false)
**Purpose:** Vector similarity search for embeddings
**Configuration:**
```env
USE_PGVECTOR=false  # Set to "true" to enable
```

**Note:** Currently using hybrid search with BM25 ranking instead

---

## Authentication Providers

### 1. Telegram User ID Authentication
**Type:** Platform-based authentication
**Implementation:** User ID from Telegram message (update.effective_user.id)
**Scope:** Telegram user identification only
**Code Location:** `src/bot/handlers.py`

### 2. GoTrue (Supabase Auth)
**Service:** GoTrue (JWT-based authentication)
**Docker Service:** `gotrue` on port 9999
**Features:** User signup, login, JWT tokens
**Configuration (Docker):**
```yaml
GOTRUE_DB_DRIVER: postgres
GOTRUE_DATABASE_URL: postgres://postgres:postgres@db:5432/n1_support
API_EXTERNAL_URL: http://localhost:9999
GOTRUE_DISABLE_SIGNUP: false
```

**Status:** Running but NOT actively integrated with bot
**Note:** Available for future integration or REST API authentication

---

## REST APIs & Services

### 1. PostgREST
**Service:** Auto-generated REST API from PostgreSQL
**Docker Service:** `postgrest` on port 3000
**Purpose:** REST endpoints for database tables
**Configuration:**
```yaml
PGRST_DB_URI: postgres://postgres:postgres@db:5432/n1_support
PGRST_DB_SCHEMA: public,rag
PGRST_DB_ANON_ROLE: anon
```

**Status:** Running but NOT actively used by bot
**Use Case:** Future web UI or external integrations

### 2. PostgreSQL Meta UI
**Service:** pg_meta database management UI
**Docker Service:** `meta` on port 8080
**Purpose:** Database schema visualization and management
**Configuration:**
```yaml
PG_META_PORT: 8080
PG_META_DB_HOST: db
PG_META_DB_USER: postgres
```

**Status:** Running, for development/debugging only

---

## Webhooks

**Incoming:** None implemented (Telegram polling used instead)
**Outgoing:** None implemented

**Future Considerations:**
- Telegram webhook mode (vs current polling)
- External escalation webhooks
- Third-party integration webhooks

---

## Environment Variables Reference

### Required Variables
```env
TELEGRAM_BOT_TOKEN=<telegram_bot_token>
OPENAI_API_KEY=<openai_or_minimax_api_key>
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Optional Variables with Defaults
```env
# LLM Configuration
OPENAI_MODEL=MiniMax-M2
OPENAI_BASE_URL=https://api.minimax.io/v1

# Database
RAG_SCHEMA=rag

# Application
LOG_LEVEL=INFO

# Features
USE_PGVECTOR=false
```

### Docker Compose Overrides
```env
# Automatically set in docker-compose.yml
DATABASE_URL=postgresql://postgres:postgres@db:5432/n1_support
RAG_SCHEMA=rag
LOG_LEVEL=INFO
USE_PGVECTOR=false
```

---

## Data Flow: External Integrations

```
User (Telegram)
    ↓ (TELEGRAM_BOT_API)
    ↓
Bot Application (telegram.ext.Application)
    ↓
issue_description
    ↓
OpenAI API (text analysis/classification)
    ├→ IssueClassifier.classify()
    ├→ QuestionGenerator.generate()
    └→ EmbeddingGenerator.generate_embedding()
    ↓
PostgreSQL (asyncpg)
    ├→ KBDocumentRepository (vector search)
    ├→ UserReportRepository
    ├→ ConversationRepository
    └→ EscalationRepository
    ↓
Response → User (Telegram)
```

---

## Search Architecture: BM25 + Vector Hybrid

**Primary Search:** Hybrid search combining:
1. **BM25 Ranking** - Keyword relevance (rank-bm25 library)
2. **Vector Similarity** - Semantic search (OpenAI embeddings)
3. **Language Support** - English, Portuguese, Spanish

**Knowledge Base:**
- Source: `kb_data/` directory
- Indexed to: `rag.kb_documents` table
- Search Method: `KnowledgeBaseSearcher.search()`
- Location: `src/rag/knowledge_base.py`

**Stopwords:** Multi-language (en, pt, es)
**Related Terms Expansion:** Semantic synonyms for support terms

---

## Issue Classification & Escalation

**Classifier:** `src/validation/classifier.py`
**Categories:**
- data_missing
- document_generation
- task_sprint
- login_auth
- general

**Escalation Criteria:**
- Confidence threshold not met
- Cannot reproduce issue
- Data corruption detected
- Authentication failure
- Custom escalation types

**Escalation Handler:** `src/escalation/handler.py`
- Creates escalation records in PostgreSQL
- Formats escalation summaries
- Assigns to support team

---

## Logging & Observability

**Logger Setup:** `src/utils/logger.py`
**Output:** Console/application logs
**Level:** Configurable (default: INFO)
**External Monitoring:** None (local logging only)

**Logged Events:**
- Database pool initialization
- OpenAI API calls and errors
- Telegram updates and errors
- Bot start/stop events
- Session errors

---

## Unused/Optional Integrations

| Library | Reason |
|---------|--------|
| `redis` | Installed but not used - no caching layer currently |
| `nest_asyncio` | Optional for nested event loops (not needed) |

---

## Security Considerations

**API Keys:**
- Stored in `.env` (git-ignored)
- Loaded via `python-dotenv`
- Example template: `.env.example`

**Database:**
- Default credentials in Docker (non-production)
- Should use strong passwords in production
- No encryption configured

**Telegram Token:**
- Kept confidential via env vars
- No token logging

**OpenAI API Key:**
- Kept confidential via env vars
- No key logging in error messages

---

## Production Deployment Notes

**Required Secrets:**
1. `TELEGRAM_BOT_TOKEN` - BotFather generated
2. `OPENAI_API_KEY` - OpenAI/MiniMax API key
3. `DATABASE_URL` - Production PostgreSQL connection

**Recommended Changes:**
1. Use strong PostgreSQL passwords (not 'postgres')
2. Enable SSL for database connections
3. Use environment-specific configuration
4. Implement rate limiting for Telegram
5. Add error tracking (Sentry, etc.)
6. Configure persistent logging (not just console)
7. Enable database connection encryption

