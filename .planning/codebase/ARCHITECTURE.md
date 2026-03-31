# Architecture Overview

**Last Updated:** 2026-03-30  
**Status:** N1 Support Bot - Phase 2

## Architecture Pattern

**Type:** Monolithic application with layered architecture  
**Deployment:** Single Python process with async concurrency  
**Primary Interface:** Telegram Bot (via python-telegram-bot library)

### Pattern Justification

The application follows a clean **layered architecture** pattern, separating concerns across distinct layers:
- **Presentation Layer**: Telegram bot commands and handlers
- **Application Layer**: Business logic (conversation management, escalation, validation)
- **RAG Layer**: Knowledge base search and retrieval-augmented generation
- **Data Layer**: Repositories and database models
- **Infrastructure Layer**: Database connections, external API clients

This pattern is appropriate for a single-service support bot that must handle concurrent user conversations while maintaining state and interacting with external LLM APIs.

---

## Application Layers and Responsibilities

### 1. **Presentation Layer** (`src/bot/`)

**Responsibility:** Handle Telegram interactions and translate user intents to business operations

**Components:**
- `handlers.py`: Command handlers (`/start`, `/help`, `/report`, `/search`, `/list`, `/feedback`)
- `conversation_manager.py`: Per-user conversation state management (IDLE → AWAITING_REPORT → PROVIDING_GUIDANCE → ESCALATED)
- `templates.py`: Message formatting and keyboard UI definitions
- `__init__.py`: Package initialization

**Key Abstractions:**
- `ConversationManager`: Maintains user state across messages
- `ConversationState`: Enum tracking conversation workflow stages
- `UserConversationState`: Dataclass storing per-user context

**Interactions:**
- Dispatches updates to repositories for data persistence
- Invokes validation, RAG, and escalation modules
- Formats responses according to message templates
- Manages inline keyboard confirmations

---

### 2. **Application/Business Logic Layer** (`src/escalation/`, `src/validation/`)

**Responsibility:** Implement core business rules for issue handling

#### Escalation Module (`src/escalation/handler.py`)

**Components:**
- `EscalationHandler`: Orchestrates escalation workflow
- `EscalationData`: Data class representing an escalation record

**Behavior:**
- Creates escalation records in database
- Updates user report status to "escalated"
- Formats escalation notification messages
- Formats self-service guidance messages

**Dependencies:**
- `EscalationRepository`, `UserReportRepository` (from data layer)

#### Validation Module (`src/validation/`)

**Components:**
- `IssueClassifier` (`classifier.py`): Classifies issues into categories (data_missing, document_generation, task_sprint, login_auth, general)
- `QuestionGenerator` (`questions.py`): Generates validation questions based on issue category
- `IssueClassification`: Dataclass with category, confidence, summary, area
- `EscalationDecision`: Dataclass with escalation recommendation and reason

**Classification Strategy:**
1. Primary: GPT-4o classification (if OpenAI client available)
2. Fallback: Keyword-based classification using `CATEGORY_KEYWORDS` dictionary

**Escalation Criteria:**
- Explicit user request for human help → escalate
- Cannot reproduce after troubleshooting → escalate
- Data corruption or auth failure → escalate
- Known limitations or user error → do not escalate

**Dependencies:**
- OpenAI client (optional, for GPT-4o classification)
- Knowledge base searcher (to evaluate solutions)

---

### 3. **RAG (Retrieval-Augmented Generation) Layer** (`src/rag/`)

**Responsibility:** Search knowledge base and enhance responses with relevant context

**Components:**
- `KnowledgeBaseSearcher` (`knowledge_base.py`): Multi-strategy document search
- `EmbeddingGenerator` (`embeddings.py`): Vector embedding generation (optional pgvector support)

**Search Strategies:**

1. **BM25 Ranking** (Primary)
   - Keyword-based term frequency/inverse document frequency
   - BM25 parameters: k1=1.5, b=0.75
   - Supports query expansion via `RELATED_TERMS` dictionary
   - Deduplicates results by title and content signature

2. **Vector Search** (Optional)
   - Embedding-based semantic search using pgvector
   - Falls back to BM25 if embeddings unavailable

3. **Hybrid Search** (Optional)
   - BM25 candidates + GPT-4o re-ranking
   - Weights: 40% BM25 + 60% GPT-4o relevance score

**Issue Area Classification:**
- `document_generation`: Document/transcript-related queries
- `login_auth`: Authentication and session issues
- `task_sprint`: Project management and task issues
- `data_missing`: Data visibility and retrieval problems
- `general`: Catch-all category

**Dependencies:**
- Database pool (to fetch KB documents)
- OpenAI client (optional, for GPT-4o re-ranking)
- Embedding generator (optional, for vector search)

---

### 4. **Data Layer** (`src/database/`)

**Responsibility:** Manage database connections, models, and data access patterns

**Components:**
- `connection.py`: Database pool management
- `models.py`: SQLAlchemy ORM models
- `repositories.py`: Repository classes for data access

#### Database Models

**KBDocument**
- `id` (UUID): Primary key
- `area` (text): Category/section
- `title` (text): Document title
- `content` (text): Full document content
- `file_path` (text, unique): Source file location
- `created_at` (datetime): Index timestamp

**UserReport**
- `id` (UUID): Primary key
- `user_id` (UUID, nullable): Telegram user identifier
- `project_id` (UUID, nullable): Related project
- `description` (text): Issue description
- `status` (text): pending, processing, resolved, escalated
- `rating` (text, nullable): User satisfaction rating
- `created_at` (datetime): Creation timestamp

**Conversation**
- `id` (UUID): Primary key
- `user_report_id` (UUID, FK): Parent report
- `role` (text): "user" or "bot"
- `message` (text): Message content
- `created_at` (datetime): Message timestamp

**Escalation**
- `id` (UUID): Primary key
- `user_report_id` (UUID, FK): Parent report
- `summary` (text): Escalation reason
- `project_name` (text, nullable): Related project
- `impact` (text, nullable): User impact description
- `assigned_to` (UUID, nullable): Assigned agent ID
- `status` (text): open, in_progress, resolved, closed
- `created_at` (datetime): Escalation timestamp

#### Repositories

**KBDocumentRepository**
- `search(query, area, limit)`: Full-text search
- `get_by_id(doc_id)`: Retrieve by UUID
- `get_by_area(area)`: Filter by category
- `get_by_file_path(file_path)`: Unique lookup
- `count()`: Total document count
- `create(area, title, content, file_path)`: Insert document

**UserReportRepository**
- `create(description, user_id, project_id)`: Create new report
- `get_by_id(report_id)`: Retrieve by UUID
- `get_by_user(user_id)`: Get user's reports
- `get_recent_by_user(user_id, limit)`: Paginated user reports
- `update_status(report_id, status)`: Update status
- `update_rating(report_id, rating)`: Record satisfaction

**ConversationRepository**
- `add_message(report_id, role, message)`: Append message
- `get_by_report(report_id)`: Retrieve conversation history

**EscalationRepository**
- `create(report_id, summary, project_name, impact, assigned_to)`: Create escalation
- `get_by_report(report_id)`: Lookup escalation for report
- `update_status(escalation_id, status)`: Update escalation status

#### Database Pool

**DatabasePool** (`connection.py`)
- Async SQLAlchemy engine with asyncpg driver
- Connection pooling: size=10, max_overflow=20
- Connection health checks (pool_pre_ping=True)
- Session lifecycle management via context manager
- Schema initialization ("rag" schema)

---

### 5. **Configuration Layer** (`src/config.py`)

**Responsibility:** Manage environment configuration and validation

**Config Parameters:**
- `telegram_bot_token`: Telegram Bot API token (required)
- `openai_api_key`: API key for LLM (required)
- `database_url`: PostgreSQL connection string (required)
- `openai_model`: Model name (default: "MiniMax-M2")
- `openai_base_url`: API endpoint (default: MiniMax API)
- `rag_schema`: DB schema name (default: "rag")
- `log_level`: Logging verbosity (default: "INFO")
- `use_pgvector`: Enable vector embeddings (default: false)

**Validation:** Ensures required fields are present before application startup

---

### 6. **Infrastructure/Utilities Layer** (`src/utils/`)

**Responsibility:** Provide cross-cutting utilities

**Components:**
- `openai_client.py`: OpenAI API wrapper
- `logger.py`: Structured logging configuration

**OpenAIClient**
- `chat_completion()`: Standard chat API
- `structured_completion()`: JSON mode responses
- Error handling and retry logic
- MiniMax-compatible (uses custom base_url)

---

## Data Flow

### Typical User Interaction Flow

```
1. USER INITIATES REPORT
   /report "My issue description"
       ↓
   handlers.report_command()
       ↓
   UserReportRepository.create() → DB: INSERT user_reports
       ↓
   KnowledgeBaseSearcher.find_relevant_articles()
       → BM25 search over kb_documents
       → Optional: GPT-4o re-ranking
       ↓
   IssueClassifier.classify()
       → Primary: GPT-4o classification
       → Fallback: Keyword classification
       ↓
   QuestionGenerator.generate_questions()
       → Based on classified category
       ↓
   ConversationManager.update_user_state()
       → state = AWAITING_VALIDATION_ANSWER
       ↓
   Send validation question to user

2. USER PROVIDES VALIDATION ANSWER
   Message handler receives answer
       ↓
   ConversationRepository.add_message()
       → DB: INSERT conversations (role='user')
       ↓
   IssueClassifier.should_escalate()
       → Analyze answers + KB results
       → Determine escalation necessity
       ↓
   Decision Branch:

   A. ESCALATE
      EscalationHandler.create_escalation()
          ↓
      EscalationRepository.create() → DB: INSERT escalations
      UserReportRepository.update_status('escalated')
          ↓
      format_escalation() → Send escalation message
      ConversationManager.update_user_state(state=ESCALATED)

   B. SELF-SERVICE
      EscalationHandler.format_self_service_message()
          ↓
      ConversationRepository.add_message(role='bot')
      ConversationManager.update_user_state(state=PROVIDING_GUIDANCE)
          ↓
      Send guidance message with KB article

3. COLLECT FEEDBACK
   /feedback <rating>
       ↓
   UserReportRepository.update_rating()
       ↓
   Confirm feedback recorded
```

### Search Flow (BM25 Pipeline)

```
User Issue Description
       ↓
KnowledgeBaseSearcher._extract_search_terms()
   - Tokenize, remove stopwords (multilingual)
   - Extract n-grams and phrases
   - Filter short/common terms
       ↓
KnowledgeBaseSearcher._expand_query_terms()
   - Lookup RELATED_TERMS dictionary
   - Add synonyms and related terms
       ↓
KnowledgeBaseSearcher._bm25_search()
   - Fetch candidates (ILIKE on title/content)
   - Calculate BM25 scores
       - Title term frequency weighted 3x
       - Content term frequency
       - Inverse document frequency (IDF)
       - Length normalization (doc_length/avgdl)
   - Sort by score descending
       ↓
KnowledgeBaseSearcher._deduplicate_results()
   - Remove similar titles/content signatures
       ↓
Optional: KnowledgeBaseSearcher._rerank_with_gpt4o()
   - Batch evaluate via GPT-4o
   - Combine scores (40% BM25, 60% GPT)
       ↓
Return top-K articles
```

---

## Key Abstractions and Interfaces

### Conversation State Machine

```
IDLE
  ↓
  /report command
  ↓
AWAITING_VALIDATION_ANSWER (multiple cycles)
  ↓
  Classification + Escalation decision
  ├→ ESCALATED (if should_escalate = true)
  └→ PROVIDING_GUIDANCE (if should_escalate = false)
  ↓
/feedback command (optional)
  ↓
IDLE (cycle complete)
```

### Repository Pattern

All data access goes through repositories:
- `KBDocumentRepository`
- `UserReportRepository`
- `ConversationRepository`
- `EscalationRepository`

Each repository:
- Encapsulates SQLAlchemy queries
- Provides typed return values
- Handles session lifecycle
- Logs operations for debugging

### Dependency Injection

Components receive dependencies via constructor:
- `EscalationHandler(escalation_repo, user_report_repo)`
- `IssueClassifier(openai_client, kb_searcher, question_generator)`
- `KnowledgeBaseSearcher(db_pool, embedding_generator, openai_client, enable_reranking)`

This enables:
- Easy testing with mock objects
- Substitution of implementations
- Clear dependency documentation

### Async/Await Patterns

The entire bot runs asynchronously:
- `Application.polling()` from telegram-bot library
- `AsyncSession` for database operations
- `asyncpg` driver for non-blocking I/O
- Context managers for resource cleanup

---

## Entry Points

### Main Entry Point

**File:** `src/main.py`

**Execution Flow:**
1. Load configuration from environment
2. Validate required settings
3. Initialize database pool and schema
4. Create OpenAI client wrapper
5. Build Telegram Application with handlers
6. Start polling for updates
7. Handle graceful shutdown on KeyboardInterrupt

**Command:** `python -m src.main`

### Scripts

**File:** `scripts/seed_kb.py`

Utility to populate knowledge base with documents from files. Used for testing and initial KB setup.

---

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

---

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

---

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

