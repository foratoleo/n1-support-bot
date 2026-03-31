# Technology Stack - RAG Workforce Project

**Last Updated:** 2026-03-30
**Created:** 2026-03-30

## Overview
N1 Support Bot - A Telegram-based AI-powered support system with Retrieval-Augmented Generation (RAG) capabilities, built in Python with async-first architecture.

---

## Languages and Versions

| Component | Version |
|-----------|---------|
| Python | 3.11+ (3.14.2 tested) |
| Docker Base | python:3.11-slim |
| PostgreSQL | 15-alpine |

---

## Runtime Environment

**Execution Model:**
- **Async Runtime:** asyncio-based async/await pattern throughout
- **Concurrency:** asyncpg for async PostgreSQL operations
- **Entry Point:** `python -m src.main`
- **Containerization:** Docker + Docker Compose

**Python Virtual Environment:** `venv/` (local development)

---

## Core Frameworks and Libraries

### Telegram Integration
| Library | Version | Purpose |
|---------|---------|---------|
| `python-telegram-bot` | 21.7 | Telegram bot framework, handlers, updaters, polling |

### AI/LLM Integration
| Library | Version | Purpose |
|---------|---------|---------|
| `openai` | >=1.80.0 | OpenAI API client (supports MiniMax API via custom base_url) |

### Database & ORM
| Library | Version | Purpose |
|---------|---------|---------|
| `psycopg2-binary` | >=2.9.10 | PostgreSQL binary driver (legacy support) |
| `sqlalchemy` | >=2.0.40 | Async ORM, schema management, model definitions |
| `asyncpg` | >=0.30.0 | Async PostgreSQL driver (primary) |

### Vector Database Support
| Library | Version | Purpose |
|---------|---------|---------|
| `pgvector` | >=0.3.0 | PostgreSQL vector extension (optional, USE_PGVECTOR=false by default) |

### Search & NLP
| Library | Version | Purpose |
|---------|---------|---------|
| `rank-bm25` | >=0.2.2 | BM25 ranking algorithm for hybrid search |
| `nltk` | >=3.9.0 | Natural Language Toolkit for text processing |

### Utilities
| Library | Version | Purpose |
|---------|---------|---------|
| `python-dotenv` | >=1.0.1 | Environment variable loading (.env files) |
| `pydantic` | >=2.10.0 | Data validation, configuration schemas |
| `httpx` | >=0.28.0 | Async HTTP client (fallback HTTP operations) |
| `nest_asyncio` | >=0.9.0 | Nested event loop support (optional) |

### Testing Framework
| Library | Version | Purpose |
|---------|---------|---------|
| `pytest` | >=8.3.0 | Test runner and assertions |
| `pytest-asyncio` | >=0.25.0 | Async test support |
| `pytest-cov` | >=6.0.0 | Coverage reporting |
| `pytest-mock` | >=3.14.0 | Mocking utilities |

### Optional/Installed But Unused
| Library | Version | Note |
|---------|---------|------|
| `redis` | >=5.2.0 | Installed but not used in src/ code |

---

## Configuration Approach

**Configuration Method:** Environment Variables + Dataclass
- **Config File:** `src/config.py` (Config dataclass)
- **Env Loading:** `python-dotenv` via `load_dotenv()`
- **Source:** `.env` file (see `.env.example`)

**Configuration Properties:**
```python
# Required
- TELEGRAM_BOT_TOKEN (Telegram API token)
- OPENAI_API_KEY (LLM API key)
- DATABASE_URL (PostgreSQL connection string)

# Optional with defaults
- OPENAI_MODEL (default: "MiniMax-M2")
- OPENAI_BASE_URL (default: "https://api.minimax.io/v1")
- RAG_SCHEMA (default: "rag")
- LOG_LEVEL (default: "INFO")
- USE_PGVECTOR (default: false)
```

**Validation:** Config.validate() enforces required fields at startup

---

## Build and Run Commands

### Local Development

**Setup:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Configuration:**
```bash
cp .env.example .env
# Edit .env with your Telegram bot token and OpenAI API key
```

**Run Bot:**
```bash
python -m src.main
```

**Run Tests:**
```bash
pytest                    # Run all tests
pytest -v --cov          # With coverage
pytest tests/rag/        # Specific test directory
```

### Docker Deployment

**Build Docker Image:**
```bash
docker build -t n1-support-bot:latest .
```

**Local Services (PostgreSQL, PostgREST, GoTrue, Meta):**
```bash
docker-compose up -d db postgrest gotrue meta
# On Windows: docker-compose up -d db postgrest gotrue meta
```

**Run Bot in Container:**
```bash
docker-compose --profile bot up n1-support-bot
```

**Full Stack:**
```bash
docker-compose up -d
# or with bot profile:
docker-compose --profile bot up -d
```

**Cleanup:**
```bash
docker-compose down -v  # -v removes volumes
```

### Database Initialization

**Automatic (on app startup):**
- Runs `await pool.init_database()` in `src/main.py`
- Creates `rag` schema and tables from SQLAlchemy models
- Initializes from `supabase/init.sql` in Docker

**Manual initialization:**
- SQL schema is in `supabase/init.sql`
- Models are in `src/database/models.py`

---

## Directory Structure

```
ragworkforce/
├── src/
│   ├── main.py                 # Entry point
│   ├── config.py               # Configuration
│   ├── bot/                    # Telegram handlers and templates
│   ├── database/               # SQLAlchemy models, repositories
│   ├── rag/                    # RAG engine (embeddings, knowledge base)
│   ├── escalation/             # Escalation handler
│   ├── validation/             # Issue classifier, question generator
│   └── utils/                  # Logger, OpenAI client
├── tests/                      # Pytest test suite
├── supabase/                   # PostgreSQL initialization scripts
├── kb_data/                    # Knowledge base documents
├── docs/                       # Documentation
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Container configuration
├── docker-compose.yml          # Multi-service orchestration
└── .env.example                # Configuration template
```

---

## Database Schema

**Primary Database:** PostgreSQL 15
**Schemas:**
- `rag` (custom schema for bot-specific tables)
- `public` (default)

**Key Tables (in `rag` schema):**
- `kb_documents` - Knowledge base articles
- `user_reports` - User issue reports
- `conversations` - Message history
- `escalations` - Escalated issues

---

## Service Architecture (Docker Compose)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:15-alpine | 5432 | PostgreSQL database |
| `postgrest` | postgrest/postgrest:latest | 3000 | Auto-generated REST API |
| `gotrue` | supabase/gotrue:latest | 9999 | Authentication (JWT) |
| `meta` | postgres/meta:latest | 8080 | PostgreSQL metadata UI |
| `n1-support-bot` | custom (Dockerfile) | - | Main bot application |

**Network:** `n1-support-network` (shared Docker bridge)

---

## Key Async Patterns

- **Connection Pool:** `DatabasePool` with asyncpg engine
- **Session Management:** AsyncSession context managers
- **Handlers:** Async Telegram event handlers
- **HTTP Calls:** httpx for async requests
- **Error Handling:** Exception propagation with logging

---

## Logging Configuration

**Logger Setup:** `src/utils/logger.py`
**Log Level:** Configurable via LOG_LEVEL env var (default: INFO)
**Format:** Structured logging with timestamps

