# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**
- Python 3.11+ - Core bot application, database operations, RAG processing

**Secondary:**
- TypeScript - Supabase Edge Functions (Deno runtime)
- SQL - Database schema definitions

## Runtime

**Environment:**
- Python 3.11-slim - Docker container base
- Deno - Supabase Edge Functions runtime

**Package Manager:**
- pip - Python dependency management
- requirements.txt - Dependency specification
- Lockfile: Not present (pip freeze not used)

## Frameworks

**Core:**
- python-telegram-bot 21.7 - Telegram Bot API framework with polling support
- SQLAlchemy 2.0.40+ - ORM and database abstraction layer

**LLM Integration:**
- openai 1.80.0+ - OpenAI-compatible API client (MiniMax, OpenAI, local models)

**Database:**
- asyncpg 0.30.0+ - Async PostgreSQL driver (primary)
- psycopg2-binary 2.9.10+ - Sync PostgreSQL driver (legacy support)

**Search/NLP:**
- rank-bm25 0.2.2+ - BM25 ranking for hybrid search
- nltk 3.9.0+ - Natural language processing

**Configuration:**
- pydantic 2.10.0+ - Data validation
- python-dotenv 1.0.1+ - Environment variable loading

**HTTP:**
- httpx 0.28.0+ - Async HTTP client

**Testing:**
- pytest 8.3.0+ - Test runner
- pytest-asyncio 0.25.0+ - Async test support
- pytest-cov 6.0.0+ - Coverage reporting
- pytest-mock 3.14.0+ - Mocking utilities

## Key Dependencies

**Critical:**
- `python-telegram-bot==21.7` - Telegram bot framework, handlers, polling
- `openai>=1.80.0` - LLM API client with OpenAI compatibility
- `sqlalchemy>=2.0.40` - ORM, schema management, model definitions
- `asyncpg>=0.30.0` - Async PostgreSQL driver (primary database access)

**Infrastructure:**
- `psycopg2-binary>=2.9.10` - PostgreSQL connection (legacy/sync operations)
- `rank-bm25>=0.2.2` - BM25 ranking algorithm for hybrid search
- `nltk>=3.9.0` - Text processing (stopwords, tokenization)

**Optional (installed but may not be used):**
- `pgvector>=0.3.0` - Vector similarity search (USE_PGVECTOR=false by default)
- `redis>=5.2.0` - Caching (installed but not used in src/ code)
- `nest_asyncio>=0.9.0` - Nested event loop support

## Configuration

**Environment Variables:**
- `TELEGRAM_BOT_TOKEN` - Telegram Bot API token (required)
- `OPENAI_API_KEY` - LLM API key (required)
- `DATABASE_URL` - PostgreSQL connection string (required)
- `OPENAI_MODEL` - Model name (default: "MiniMax-M2")
- `OPENAI_BASE_URL` - API endpoint (default: "https://api.minimax.io/v1")
- `RAG_SCHEMA` - Database schema (default: "rag")
- `LOG_LEVEL` - Logging level (default: "INFO")
- `USE_PGVECTOR` - Enable vector embeddings (default: false)

**Configuration Loading:**
- Config class in `src/config.py` - Dataclass-based configuration
- Environment variables loaded via `python-dotenv`
- Validation on startup via `config.validate()`

**Build Configuration:**
- `Dockerfile` - Python 3.11-slim base, multi-stage not used
- `docker-compose.yml` - Service orchestration
- `requirements.txt` - pip dependencies

## Platform Requirements

**Development:**
- Python 3.11+ installed locally
- PostgreSQL 15+ running (local or Docker)
- Telegram Bot Token from @BotFather
- OpenAI-compatible API key (MiniMax or OpenAI)

**Production:**
- Docker & Docker Compose
- PostgreSQL 15+ (managed or containerized)
- Environment variables configured in `.env` or Docker Compose

---

*Stack analysis: 2026-03-31*
