<!-- GSD:project-start source:PROJECT.md -->
## Project

**RAG Workforce Bot - Melhoria v2**

Bot de suporte N1 no Telegram para usuários da ferramenta Workforce. Recebe dúvidas e reportes de erro, busca na knowledge base usando BM25 + embeddings, classifica issues e orienta o usuário ou escalona para suporte humano. A v2 foca em traduzir toda a experiência para pt-br, implementar navegação guiada por menus inline e melhorar a qualidade das respostas e da busca.

**Core Value:** O usuário do Workforce deve conseguir resolver sua dúvida ou reportar um erro de forma rápida e guiada, sem precisar saber comandos ou digitar texto livre para navegar.

### Constraints

- **Tech stack**: Manter Python + python-telegram-bot + PostgreSQL (não trocar stack)
- **Backward compatibility**: Não quebrar funcionalidades existentes (search, feedback, escalation)
- **LLM provider**: Manter OpenAI-compatible API (MiniMax-M2 configurado)
- **Deployment**: Manter Docker Compose como método de deploy
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Overview
## Languages and Versions
| Component | Version |
|-----------|---------|
| Python | 3.11+ (3.14.2 tested) |
| Docker Base | python:3.11-slim |
| PostgreSQL | 15-alpine |
## Runtime Environment
- **Async Runtime:** asyncio-based async/await pattern throughout
- **Concurrency:** asyncpg for async PostgreSQL operations
- **Entry Point:** `python -m src.main`
- **Containerization:** Docker + Docker Compose
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
## Configuration Approach
- **Config File:** `src/config.py` (Config dataclass)
- **Env Loading:** `python-dotenv` via `load_dotenv()`
- **Source:** `.env` file (see `.env.example`)
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
## Build and Run Commands
### Local Development
# Edit .env with your Telegram bot token and OpenAI API key
### Docker Deployment
# On Windows: docker-compose up -d db postgrest gotrue meta
# or with bot profile:
### Database Initialization
- Runs `await pool.init_database()` in `src/main.py`
- Creates `rag` schema and tables from SQLAlchemy models
- Initializes from `supabase/init.sql` in Docker
- SQL schema is in `supabase/init.sql`
- Models are in `src/database/models.py`
## Directory Structure
## Database Schema
- `rag` (custom schema for bot-specific tables)
- `public` (default)
- `kb_documents` - Knowledge base articles
- `user_reports` - User issue reports
- `conversations` - Message history
- `escalations` - Escalated issues
## Service Architecture (Docker Compose)
| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:15-alpine | 5432 | PostgreSQL database |
| `postgrest` | postgrest/postgrest:latest | 3000 | Auto-generated REST API |
| `gotrue` | supabase/gotrue:latest | 9999 | Authentication (JWT) |
| `meta` | postgres/meta:latest | 8080 | PostgreSQL metadata UI |
| `n1-support-bot` | custom (Dockerfile) | - | Main bot application |
## Key Async Patterns
- **Connection Pool:** `DatabasePool` with asyncpg engine
- **Session Management:** AsyncSession context managers
- **Handlers:** Async Telegram event handlers
- **HTTP Calls:** httpx for async requests
- **Error Handling:** Exception propagation with logging
## Logging Configuration
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Code Style
### Indentation & Formatting
- **Indentation**: 4 spaces (PEP 8)
- **Line Length**: No explicit limit enforced, but code uses reasonable line wrapping
- **String Quotes**: Double quotes (`"`) preferred in most contexts
- **Trailing Whitespace**: Removed
### Examples from codebase:
## Naming Conventions
### Module/File Names
- **Lowercase with underscores**: `handlers.py`, `openai_client.py`, `knowledge_base.py`
- **Plurals for collections**: `models.py`, `repositories.py`, `handlers.py`
- **Specific domain modules**: Group by feature area in subdirectories (`bot/`, `rag/`, `database/`, `validation/`, `escalation/`, `utils/`)
### Class Names
- **PascalCase**: `ConversationManager`, `KnowledgeBaseSearcher`, `IssueClassifier`, `OpenAIClient`
- **Descriptive suffixes**: `-Manager`, `-Handler`, `-Repository`, `-Client`, `-Searcher`, `-Generator`
### Function/Method Names
- **snake_case**: `get_user_state()`, `find_relevant_articles()`, `_extract_search_terms()`, `setup_logger()`
- **Private methods**: Leading underscore `_internal_method()`
- **Async functions**: No special prefix, use `async def`
### Variable Names
- **snake_case**: `pool`, `session`, `user_id`, `issue_description`, `search_terms`
- **Descriptive names**: `conversation_manager`, `kb_searcher`, `openai_client` (not `cm`, `ks`, `oc`)
- **Boolean prefixes**: `is_`, `has_`, `should_`, `enable_` (e.g., `enable_reranking`, `use_hybrid`)
### Constants
- **UPPER_SNAKE_CASE**: `STOPWORDS`, `RELATED_TERMS`, `CATEGORY_KEYWORDS`
- **Defined at module level**
### Example naming patterns from codebase:
## Import Organization
### Structure (top to bottom):
### Example from `src/bot/handlers.py`:
### Multi-line imports:
- Use parentheses with items on separate lines
- One import per line or logical grouping by module
## Docstring Conventions
### Style
- **Google-style docstrings** with type hints
- **Module docstrings**: Module purpose as first line
- **Function/Method docstrings**: Brief description, Args, Returns, optional Raises
### Example from `src/database/repositories.py`:
### Class docstrings:
## Type Hints
### Usage:
- **Always used** on function parameters and return types
- **Optional used**: `Optional[Type]` from typing module
- **Collections**: `List[Type]`, `Dict[str, Type]`, `Tuple[Type, ...]`
- **Async**: `async def func() -> Type:`
### Example from `src/rag/knowledge_base.py`:
## Error Handling Patterns
### Exception Handling:
### Example from `src/utils/openai_client.py`:
### Validation pattern from `src/config.py`:
### Database error handling from `src/database/connection.py`:
## Logging Patterns
### Logger Setup:
- **Module-level logger**: `logger = setup_logger(__name__)` at module top
- **Log level**: Respects `LOG_LEVEL` environment variable
- **Format**: Timestamp - Module name - Level - Message
### Usage pattern from `src/database/connection.py`:
### Logger utility from `src/utils/logger.py`:
## Common Code Patterns
### Async Context Managers (Database Sessions):
### Repository Pattern:
### Dataclass Usage:
### State Management:
### Configuration Loading:
## Project Structure
## Key Design Principles Applied
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Architecture Pattern
### Pattern Justification
- **Presentation Layer**: Telegram bot commands and handlers
- **Application Layer**: Business logic (conversation management, escalation, validation)
- **RAG Layer**: Knowledge base search and retrieval-augmented generation
- **Data Layer**: Repositories and database models
- **Infrastructure Layer**: Database connections, external API clients
## Application Layers and Responsibilities
### 1. **Presentation Layer** (`src/bot/`)
- `handlers.py`: Command handlers (`/start`, `/help`, `/report`, `/search`, `/list`, `/feedback`)
- `conversation_manager.py`: Per-user conversation state management (IDLE → AWAITING_REPORT → PROVIDING_GUIDANCE → ESCALATED)
- `templates.py`: Message formatting and keyboard UI definitions
- `__init__.py`: Package initialization
- `ConversationManager`: Maintains user state across messages
- `ConversationState`: Enum tracking conversation workflow stages
- `UserConversationState`: Dataclass storing per-user context
- Dispatches updates to repositories for data persistence
- Invokes validation, RAG, and escalation modules
- Formats responses according to message templates
- Manages inline keyboard confirmations
### 2. **Application/Business Logic Layer** (`src/escalation/`, `src/validation/`)
#### Escalation Module (`src/escalation/handler.py`)
- `EscalationHandler`: Orchestrates escalation workflow
- `EscalationData`: Data class representing an escalation record
- Creates escalation records in database
- Updates user report status to "escalated"
- Formats escalation notification messages
- Formats self-service guidance messages
- `EscalationRepository`, `UserReportRepository` (from data layer)
#### Validation Module (`src/validation/`)
- `IssueClassifier` (`classifier.py`): Classifies issues into categories (data_missing, document_generation, task_sprint, login_auth, general)
- `QuestionGenerator` (`questions.py`): Generates validation questions based on issue category
- `IssueClassification`: Dataclass with category, confidence, summary, area
- `EscalationDecision`: Dataclass with escalation recommendation and reason
- Explicit user request for human help → escalate
- Cannot reproduce after troubleshooting → escalate
- Data corruption or auth failure → escalate
- Known limitations or user error → do not escalate
- OpenAI client (optional, for GPT-4o classification)
- Knowledge base searcher (to evaluate solutions)
### 3. **RAG (Retrieval-Augmented Generation) Layer** (`src/rag/`)
- `KnowledgeBaseSearcher` (`knowledge_base.py`): Multi-strategy document search
- `EmbeddingGenerator` (`embeddings.py`): Vector embedding generation (optional pgvector support)
- `document_generation`: Document/transcript-related queries
- `login_auth`: Authentication and session issues
- `task_sprint`: Project management and task issues
- `data_missing`: Data visibility and retrieval problems
- `general`: Catch-all category
- Database pool (to fetch KB documents)
- OpenAI client (optional, for GPT-4o re-ranking)
- Embedding generator (optional, for vector search)
### 4. **Data Layer** (`src/database/`)
- `connection.py`: Database pool management
- `models.py`: SQLAlchemy ORM models
- `repositories.py`: Repository classes for data access
#### Database Models
- `id` (UUID): Primary key
- `area` (text): Category/section
- `title` (text): Document title
- `content` (text): Full document content
- `file_path` (text, unique): Source file location
- `created_at` (datetime): Index timestamp
- `id` (UUID): Primary key
- `user_id` (UUID, nullable): Telegram user identifier
- `project_id` (UUID, nullable): Related project
- `description` (text): Issue description
- `status` (text): pending, processing, resolved, escalated
- `rating` (text, nullable): User satisfaction rating
- `created_at` (datetime): Creation timestamp
- `id` (UUID): Primary key
- `user_report_id` (UUID, FK): Parent report
- `role` (text): "user" or "bot"
- `message` (text): Message content
- `created_at` (datetime): Message timestamp
- `id` (UUID): Primary key
- `user_report_id` (UUID, FK): Parent report
- `summary` (text): Escalation reason
- `project_name` (text, nullable): Related project
- `impact` (text, nullable): User impact description
- `assigned_to` (UUID, nullable): Assigned agent ID
- `status` (text): open, in_progress, resolved, closed
- `created_at` (datetime): Escalation timestamp
#### Repositories
- `search(query, area, limit)`: Full-text search
- `get_by_id(doc_id)`: Retrieve by UUID
- `get_by_area(area)`: Filter by category
- `get_by_file_path(file_path)`: Unique lookup
- `count()`: Total document count
- `create(area, title, content, file_path)`: Insert document
- `create(description, user_id, project_id)`: Create new report
- `get_by_id(report_id)`: Retrieve by UUID
- `get_by_user(user_id)`: Get user's reports
- `get_recent_by_user(user_id, limit)`: Paginated user reports
- `update_status(report_id, status)`: Update status
- `update_rating(report_id, rating)`: Record satisfaction
- `add_message(report_id, role, message)`: Append message
- `get_by_report(report_id)`: Retrieve conversation history
- `create(report_id, summary, project_name, impact, assigned_to)`: Create escalation
- `get_by_report(report_id)`: Lookup escalation for report
- `update_status(escalation_id, status)`: Update escalation status
#### Database Pool
- Async SQLAlchemy engine with asyncpg driver
- Connection pooling: size=10, max_overflow=20
- Connection health checks (pool_pre_ping=True)
- Session lifecycle management via context manager
- Schema initialization ("rag" schema)
### 5. **Configuration Layer** (`src/config.py`)
- `telegram_bot_token`: Telegram Bot API token (required)
- `openai_api_key`: API key for LLM (required)
- `database_url`: PostgreSQL connection string (required)
- `openai_model`: Model name (default: "MiniMax-M2")
- `openai_base_url`: API endpoint (default: MiniMax API)
- `rag_schema`: DB schema name (default: "rag")
- `log_level`: Logging verbosity (default: "INFO")
- `use_pgvector`: Enable vector embeddings (default: false)
### 6. **Infrastructure/Utilities Layer** (`src/utils/`)
- `openai_client.py`: OpenAI API wrapper
- `logger.py`: Structured logging configuration
- `chat_completion()`: Standard chat API
- `structured_completion()`: JSON mode responses
- Error handling and retry logic
- MiniMax-compatible (uses custom base_url)
## Data Flow
### Typical User Interaction Flow
```
```
### Search Flow (BM25 Pipeline)
```
```
## Key Abstractions and Interfaces
### Conversation State Machine
```
```
### Repository Pattern
- `KBDocumentRepository`
- `UserReportRepository`
- `ConversationRepository`
- `EscalationRepository`
- Encapsulates SQLAlchemy queries
- Provides typed return values
- Handles session lifecycle
- Logs operations for debugging
### Dependency Injection
- `EscalationHandler(escalation_repo, user_report_repo)`
- `IssueClassifier(openai_client, kb_searcher, question_generator)`
- `KnowledgeBaseSearcher(db_pool, embedding_generator, openai_client, enable_reranking)`
- Easy testing with mock objects
- Substitution of implementations
- Clear dependency documentation
### Async/Await Patterns
- `Application.polling()` from telegram-bot library
- `AsyncSession` for database operations
- `asyncpg` driver for non-blocking I/O
- Context managers for resource cleanup
## Entry Points
### Main Entry Point
### Scripts
## External Dependencies
### Required Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| `python-telegram-bot` | 21.7 | Telegram Bot API bindings |
| `openai` | ≥1.80.0 | OpenAI/MiniMax API client |
| `sqlalchemy` | ≥2.0.40 | ORM and database abstraction |
| `asyncpg` | ≥0.30.0 | Async PostgreSQL driver |
| `psycopg2-binary` | ≥2.9.10 | PostgreSQL connection layer |
| `pydantic` | ≥2.10.0 | Data validation (future use) |
| `python-dotenv` | ≥1.0.1 | Environment variable loading |
| `httpx` | ≥0.28.0 | Async HTTP client |
### Optional Libraries
| Library | Purpose |
|---------|---------|
| `rank-bm25` | Offline BM25 scoring (currently inline) |
| `nltk` | Natural language processing |
| `redis` | Caching and session management |
| `pgvector` | Vector similarity search |
## Technology Stack Summary
| Component | Technology |
|-----------|-----------|
| **Bot Framework** | python-telegram-bot 21.7 |
| **Language Model** | MiniMax API (OpenAI-compatible) |
| **Database** | PostgreSQL with asyncpg |
| **ORM** | SQLAlchemy 2.0+ |
| **Async Runtime** | asyncio |
| **Search** | BM25 (in-memory) + optional pgvector |
| **Config** | Environment variables + pydantic |
| **Logging** | Python standard library |
| **Testing** | pytest + pytest-asyncio |
## Design Patterns Used
| Pattern | Location | Purpose |
|---------|----------|---------|
| **Repository** | `src/database/repositories.py` | Abstract data access |
| **Singleton** | `ConversationManager`, `DatabasePool` | Global state management |
| **Factory** | `Config.from_env()`, `EscalationData.create()` | Object creation |
| **Decorator** | `@CommandHandler`, `@MessageHandler` | Telegram command binding |
| **Strategy** | Classification + Escalation decision | Pluggable algorithms |
| **Context Manager** | `pool.acquire()`, database sessions | Resource lifecycle |
| **Async/Await** | Throughout | Non-blocking I/O |
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
