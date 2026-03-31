# Codebase Structure

**Analysis Date:** 2026-03-31

## Directory Layout

```
ragworkforce/
├── src/                      # Main source code
│   ├── main.py               # Application entry point
│   ├── config.py             # Configuration dataclass
│   ├── bot/                  # Telegram bot layer
│   │   ├── handlers.py       # Command handlers (/start, /report, etc.)
│   │   ├── conversation_manager.py  # State machine
│   │   ├── callback_router.py      # Prefix-based callback routing
│   │   ├── keyboards.py      # InlineKeyboard factory functions
│   │   ├── templates.py      # Message formatting helpers
│   │   ├── strings.py        # All user-facing text (pt-BR)
│   │   ├── _callback_handlers.py  # Concrete callback handlers
│   │   ├── kb_browser.py     # KB navigation handlers
│   │   ├── report_wizard.py  # Guided error report flow
│   │   ├── feedback_handler.py    # Inline feedback handling
│   │   └── state_handlers/    # State-specific message handlers
│   ├── database/             # Data access layer
│   │   ├── connection.py     # DatabasePool, async session management
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── repositories.py   # Repository classes (CRUD)
│   ├── rag/                  # RAG/knowledge base search
│   │   ├── knowledge_base.py # BM25Plus + optional vector search
│   │   └── embeddings.py     # Embedding generation
│   ├── validation/           # Issue classification
│   │   ├── classifier.py     # IssueClassifier
│   │   └── questions.py      # QuestionGenerator
│   ├── escalation/           # Escalation handling
│   │   └── handler.py        # EscalationHandler
│   └── utils/                # Utilities
│       ├── openai_client.py  # OpenAI/MiniMax API wrapper
│       └── logger.py         # Logging configuration
├── tests/                    # Test files
├── supabase/                 # Database initialization SQL
├── kb_data/                  # Knowledge base source files
├── docs/                     # Documentation
├── scripts/                  # Utility scripts
├── docker-compose.yml        # Docker services configuration
├── Dockerfile                # Bot container definition
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
└── .planning/                # GSD planning artifacts
    └── codebase/             # Codebase analysis documents
```

## Directory Purposes

**`src/` - Main Source Code:**
- Purpose: All Python source code for the bot application
- Contains: Entry point, all modules organized by layer
- Key files: `main.py`, `config.py`

**`src/bot/` - Presentation Layer:**
- Purpose: Telegram bot interface, handlers, keyboards, templates, strings
- Contains: Command handlers, state handlers, callback handlers, UI components
- Key files: `handlers.py`, `conversation_manager.py`, `keyboards.py`, `templates.py`, `strings.py`

**`src/bot/state_handlers/` - State-Specific Handlers:**
- Purpose: Handle user messages based on current conversation state
- Contains: `idle.py`, `awaiting_report.py`, `awaiting_validation.py`, `providing_guidance.py`, `escalated.py`, `collecting_report.py`, `awaiting_kb_search.py`, `awaiting_feedback_comment.py`
- Key file: `__init__.py` exports `dispatch()` function

**`src/database/` - Data Layer:**
- Purpose: Database connection pooling, ORM models, repository classes
- Contains: `connection.py`, `models.py`, `repositories.py`

**`src/rag/` - RAG Layer:**
- Purpose: Knowledge base search and retrieval
- Contains: `knowledge_base.py`, `embeddings.py`

**`src/validation/` - Validation Layer:**
- Purpose: Issue classification and validation questions
- Contains: `classifier.py`, `questions.py`

**`src/escalation/` - Escalation Layer:**
- Purpose: Human handoff for complex issues
- Contains: `handler.py`

**`src/utils/` - Utilities:**
- Purpose: Shared utilities (OpenAI client, logging)
- Contains: `openai_client.py`, `logger.py`

**`tests/` - Test Suite:**
- Purpose: Unit and integration tests
- Contains: Test files matching source module structure

**`supabase/` - Database Schema:**
- Purpose: PostgreSQL initialization scripts
- Contains: `init.sql`

## Key File Locations

**Entry Points:**
- `src/main.py`: Application startup, initializes all components

**Configuration:**
- `src/config.py`: `Config` dataclass loading from environment variables
- `.env.example`: Template with all required variables

**State Management:**
- `src/bot/conversation_manager.py`: `ConversationManager`, `ConversationState`, `UserConversationState`

**Command Handlers:**
- `src/bot/handlers.py`: `register_handlers()`, command handlers (`start_command`, `report_command`, etc.)

**Callback Routing:**
- `src/bot/callback_router.py`: `route_callback()`, `register()` decorator
- `src/bot/_callback_handlers.py`: Concrete handler implementations with `@register` decorators

**Inline Keyboards:**
- `src/bot/keyboards.py`: All `InlineKeyboardMarkup` factory functions

**Message Templates:**
- `src/bot/templates.py`: `format_*()` functions for response formatting
- `src/bot/strings.py`: All string constants in Portuguese

**Database:**
- `src/database/connection.py`: `DatabasePool`, `get_database_pool()`
- `src/database/models.py`: SQLAlchemy `Base`, `KBDocument`, `UserReport`, `Conversation`, `Escalation`
- `src/database/repositories.py`: `*Repository` classes

**RAG:**
- `src/rag/knowledge_base.py`: `KnowledgeBaseSearcher` with BM25Plus
- `src/rag/embeddings.py`: `EmbeddingGenerator` (optional pgvector)

**Validation:**
- `src/validation/classifier.py`: `IssueClassifier`, `IssueClassification`, `EscalationDecision`
- `src/validation/questions.py`: `QuestionGenerator`, `Question`

**Escalation:**
- `src/escalation/handler.py`: `EscalationHandler`, `EscalationData`

## Naming Conventions

**Files:**
- `snake_case.py`: All Python modules (e.g., `conversation_manager.py`, `callback_router.py`)
- `__init__.py`: Package initialization files
- Prefix underscore for private modules: `_callback_handlers.py`

**Directories:**
- `lowercase/`: All package directories
- `state_handlers/`: Plural for collection of similar modules
- `_private/`: Prefix underscore for private packages

**Classes:**
- `PascalCase`: All class names (e.g., `ConversationManager`, `KnowledgeBaseSearcher`)
- Suffix patterns: `-Manager`, `-Handler`, `-Searcher`, `-Generator`, `-Repository`, `-Client`
- Dataclasses: `PascalCase` (e.g., `UserConversationState`, `IssueClassification`)

**Functions/Methods:**
- `snake_case`: All function and method names
- Async functions: No special prefix, use `async def`
- Private methods: Leading underscore `_private_method()`
- Factory methods: `create()` class method

**Variables:**
- `snake_case`: All variable names
- Descriptive names: `conversation_manager`, `user_report_repo`
- Boolean prefixes: `is_`, `has_`, `enable_` (e.g., `enable_reranking`, `use_hybrid`)

**Constants:**
- `UPPER_SNAKE_CASE`: Module-level constants
- Examples: `STOPWORDS`, `RELATED_TERMS`, `CATEGORY_KEYWORDS`, `CB_YES_RESOLVED`

**Type Variables:**
- `PascalCase`: Type aliases and generic type parameters
- Examples: `List[str]`, `Dict[str, Any]`, `Optional[UUID]`

## Where to Add New Code

**New Command Handler:**
1. Add handler function to `src/bot/handlers.py`
2. Register in `register_handlers()` function
3. Add command to `src/bot/strings.py` if new strings needed

**New State Handler:**
1. Create `src/bot/state_handlers/new_state.py`
2. Export handler function `async def handle(update, context, user_state, conv_manager)`
3. Import and add to `DISPATCHER` dict in `src/bot/state_handlers/__init__.py`
4. Add new `ConversationState` value if needed

**New Callback Handler:**
1. Add to `src/bot/_callback_handlers.py` (or appropriate sub-module)
2. Use `@register("prefix:")` decorator
3. Call `await query.answer()` first (NAV-07 requirement)

**New Keyboard:**
1. Add factory function to `src/bot/keyboards.py`
2. Follow naming: `get_<purpose>_keyboard() -> InlineKeyboardMarkup`
3. Use `_assert_callback_data()` to validate 64-byte limit
4. Add button strings to `src/bot/strings.py`

**New Message Template:**
1. Add string constant to `src/bot/strings.py`
2. Add format function to `src/bot/templates.py`
3. Follow naming: `format_<purpose>() -> str`

**New Repository Method:**
1. Add method to appropriate class in `src/database/repositories.py`
2. Follow async pattern: `async def method_name() -> ReturnType`
3. Use `self.session` for database operations

**New RAG Feature:**
1. Add to `src/rag/knowledge_base.py` or `src/rag/embeddings.py`
2. Follow async pattern where appropriate

**New Validation Logic:**
1. Add to `src/validation/classifier.py` or `src/validation/questions.py`

## Special Directories

**`src/bot/` - Bot Package:**
- Purpose: All Telegram bot functionality
- Exported via `src/bot/__init__.py` (minimal)

**`tests/` - Test Directory:**
- Purpose: Test files matching source structure
- Test files: `test_*.py` or `*_test.py` pattern

**`.planning/` - GSD Planning:**
- Purpose: Planning artifacts and phase documentation
- Structure: `.planning/codebase/` for architecture docs, `.planning/phases/` for phase work

**`kb_data/` - Knowledge Base Source:**
- Purpose: Source files for KB indexing
- Format: Markdown files organized by topic

---

*Structure analysis: 2026-03-31*
