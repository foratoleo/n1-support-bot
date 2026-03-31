# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**Telegram Bot API:**
- Service: Telegram Bot API
  - SDK: `python-telegram-bot` 21.7
  - Auth: `TELEGRAM_BOT_TOKEN` environment variable
  - Usage: Bot polling for incoming messages, sending responses, inline keyboards
  - File: `src/main.py`, `src/bot/handlers.py`

**LLM Provider (OpenAI-compatible):**
- Service: MiniMax API (default) or OpenAI API
  - SDK: `openai` Python library 1.80.0+
  - Auth: `OPENAI_API_KEY` environment variable
  - Base URL: `https://api.minimax.io/v1` (configurable via `OPENAI_BASE_URL`)
  - Model: `MiniMax-M2` (configurable via `OPENAI_MODEL`)
  - Usage: Issue classification, response generation, structured outputs
  - Files: `src/utils/openai_client.py`, `src/validation/classifier.py`

## Data Storage

**PostgreSQL Database:**
- Type: PostgreSQL 15-alpine (Docker)
- Connection: `postgresql://postgres:postgres@db:5432/n1_support`
- Schema: `rag` (custom schema)
- Client: `asyncpg` (async) + `psycopg2-binary` (sync)
- Connection pooling: pool_size=10, max_overflow=20
- ORM: SQLAlchemy 2.0.40+ with async engine
- Files: `src/database/connection.py`, `src/database/models.py`

**Database Tables (in `rag` schema):**
- `rag.kb_documents` - Knowledge base articles (id, area, title, content, file_path, created_at)
- `rag.user_reports` - User issue reports (id, user_id, project_id, description, status, rating, created_at)
- `rag.conversations` - Message history (id, user_report_id, role, message, created_at)
- `rag.escalations` - Escalated issues (id, user_report_id, summary, project_name, impact, assigned_to, status, created_at)

**File Storage:**
- Local filesystem: `kb_data/` directory for knowledge base source files
- Seed script: `scripts/seed_kb.py` for populating KB documents

## Docker Compose Services

**Database Services:**
| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:15-alpine | 5432 | PostgreSQL database |
| `postgrest` | postgrest/postgrest:latest | 3000 | Auto-generated REST API |
| `gotrue` | supabase/gotrue:latest | 9999 | Authentication/JWT |
| `meta` | postgres/meta:latest | 8080 | PostgreSQL metadata UI |
| `n1-support-bot` | custom (Dockerfile) | - | Main bot application |

## Supabase Integration

**Supabase Edge Functions (TypeScript/Deno):**
- Located in: `supabase/functions/`
- Runtime: Deno (JavaScript/TypeScript)
- Shared modules: `supabase/functions/_shared/` (cors, jira-client, jira-db-service, batch-processor)

**JIRA Integration (via Supabase Edge Functions):**
- Service: JIRA Cloud API
- Client: Custom `JiraClient` class in `_shared/jira-client.ts`
- Auth: API token (encrypted in database), email
- Sync operations: JIRA → DR-AI, DR-AI → JIRA bidirectional sync
- Files: `supabase/functions/sync-jira-to-drai/index.ts`, `supabase/functions/sync-drai-to-jira/index.ts`

**Microsoft Integration (Edge Functions):**
- Microsoft OAuth: `supabase/functions/ms-oauth-initiate/`, `supabase/functions/ms-token-refresh/`
- Microsoft Calendar: `supabase/functions/ms-calendar-create-event/`
- Recall Calendar Webhook: `supabase/functions/recall-calendar-webhook/`

**S3/Storage Integration:**
- Presigned S3 uploads: `supabase/functions/upload-to-presigned-s3/`

## Authentication & Identity

**Telegram User Identity:**
- User identification: `update.effective_user.id` from Telegram
- Stored as: UUID in database (converted from Telegram user ID)
- No additional auth layer needed (Telegram handles authentication)

**Supabase Auth (for Edge Functions):**
- Service: Supabase GoTrue
- Port: 9999
- JWT-based authentication for API access
- Configuration: `GOTRUE_*` environment variables

## Monitoring & Observability

**Logging:**
- Framework: Python standard library `logging`
- Logger utility: `src/utils/logger.py`
- Configuration: `LOG_LEVEL` environment variable (default: INFO)
- Output: Console (stdout)

**Error Tracking:**
- Not detected - No external error tracking service integrated
- Errors logged via logger and re-raised

**Metrics:**
- Not detected - No metrics collection service

## CI/CD & Deployment

**Hosting:**
- Self-hosted via Docker Compose
- Containerized deployment with `n1-support-bot` service

**Docker Deployment:**
```bash
# Core services (no bot)
docker-compose up -d db postgrest gotrue meta

# With bot
docker-compose --profile bot up -d
```

**Local Development:**
- Python virtual environment (`.venv/`, `venv/`)
- Direct execution: `python -m src.main`

## Environment Configuration

**Required Environment Variables:**
```
TELEGRAM_BOT_TOKEN=<telegram_bot_token>
OPENAI_API_KEY=<api_key>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/n1_support
```

**Optional Environment Variables:**
```
OPENAI_MODEL=MiniMax-M2
OPENAI_BASE_URL=https://api.minimax.io/v1
RAG_SCHEMA=rag
LOG_LEVEL=INFO
USE_PGVECTOR=false
```

**Secrets Location:**
- `.env` file (git-ignored, never committed)
- `.env.example` for template

## Webhooks & Callbacks

**Incoming Webhooks:**
- JIRA webhooks: `supabase/functions/jira-webhook/index.ts`
- Recall webhooks: `supabase/functions/recall-webhook/index.ts`, `supabase/functions/recall-calendar-webhook/index.ts`

**Outgoing:**
- Telegram API calls (via python-telegram-bot)
- LLM API calls (via openai library)
- JIRA API calls (via custom JiraClient)
- Microsoft Graph API (via Edge Functions)

---

*Integration audit: 2026-03-31*
