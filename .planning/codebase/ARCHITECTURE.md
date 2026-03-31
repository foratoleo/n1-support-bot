# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Event-Driven State Machine with Layered Architecture

**Key Characteristics:**
- Telegram bot receives events (commands, messages, callbacks) and dispatches to state handlers
- Per-user conversation state managed by `ConversationManager` with state machine pattern
- Business logic separated into distinct layers: handlers → validation → RAG → data access
- Repository pattern for all database operations
- Async/await throughout using python-telegram-bot and asyncpg

## Layers

**Presentation Layer (`src/bot/`):**
- Purpose: Telegram user interface, command routing, and message formatting
- Location: `src/bot/`
- Contains: Handlers, state handlers, keyboards, templates, strings
- Depends on: Database repositories, RAG, validation modules
- Used by: Main entry point, callback router

**State Machine (`src/bot/conversation_manager.py`):**
- Purpose: Per-user conversation state tracking with menu navigation
- Location: `src/bot/conversation_manager.py`
- Contains: `ConversationManager`, `ConversationState` enum, `UserConversationState` dataclass
- Depends on: None (pure state)
- Used by: All handlers and state handlers

**State Handlers (`src/bot/state_handlers/`):**
- Purpose: Handle messages based on current conversation state
- Location: `src/bot/state_handlers/`
- Contains: `idle.py`, `awaiting_report.py`, `awaiting_validation.py`, `providing_guidance.py`, `escalated.py`, `collecting_report.py`, `awaiting_kb_search.py`, `awaiting_feedback_comment.py`
- Depends on: Conversation manager, strings, keyboards
- Used by: Main message handler via dispatcher

**Callback Routing (`src/bot/callback_router.py`):**
- Purpose: Prefix-based routing for inline keyboard callbacks
- Location: `src/bot/callback_router.py`
- Contains: `route_callback()`, `register()` decorator, handler registry
- Used by: PTB CallbackQueryHandler

**Business Logic Layer (`src/escalation/`, `src/validation/`):**
- Purpose: Issue classification, escalation decisions, validation questions
- Location: `src/escalation/`, `src/validation/`
- Contains: `EscalationHandler`, `IssueClassifier`, `QuestionGenerator`
- Depends on: OpenAI client, KB searcher, repositories
- Used by: Command handlers, state handlers

**RAG Layer (`src/rag/`):**
- Purpose: Knowledge base search with BM25Plus and optional vector search
- Location: `src/rag/`
- Contains: `KnowledgeBaseSearcher`, `EmbeddingGenerator`
- Depends on: Database pool, OpenAI client (optional)
- Used by: Handlers, validation module

**Data Layer (`src/database/`):**
- Purpose: Database connection pooling and data access
- Location: `src/database/`
- Contains: `DatabasePool`, models, repositories
- Depends on: asyncpg, SQLAlchemy
- Used by: All modules requiring persistence

**Infrastructure Layer (`src/utils/`):**
- Purpose: OpenAI API client, logging configuration
- Location: `src/utils/`
- Contains: `OpenAIClient`, `setup_logger()`
- Used by: All modules

**Configuration Layer (`src/config.py`):**
- Purpose: Environment variable loading and validation
- Location: `src/config.py`
- Contains: `Config` dataclass
- Used by: Main entry point

## Data Flow

**Command Flow (`/report`, `/search`, `/status`, etc.):**
1. PTB receives command → `handlers.py` command handler
2. Handler validates input, acquires database session
3. Creates database record (UserReport) if applicable
4. Invokes `KnowledgeBaseSearcher.find_relevant_articles()`
5. Invokes `IssueClassifier.classify()` with KB results
6. Generates validation questions via `QuestionGenerator`
7. Updates `ConversationManager` state
8. Sends response with inline keyboard

**Callback Flow (inline button press):**
1. PTB receives callback → `CallbackQueryHandler` → `route_callback()`
2. Router looks up handler by prefix in registry
3. Handler processes callback (creates escalation, navigates menu, etc.)
4. Updates `ConversationManager` state atomically with message edit
5. Sends new inline keyboard if needed

**Message Flow (free text during workflow):**
1. PTB receives message → `handle_message()`
2. Gets `UserConversationState` from `ConversationManager`
3. Dispatches to state handler via `dispatch()`
4. State handler processes based on `ConversationState` enum
5. Updates state and sends response

**Menu Navigation Flow:**
1. User presses menu button → callback starts with "menu:" prefix
2. `_callback_handlers.py` handler pushes menu node to `menu_path`
3. Breadcrumb trail maintained in `UserConversationState`
4. "Voltar" (back) button pops from `menu_path`
5. `menu_context` stores transient data per menu node

## Key Abstractions

**ConversationState Enum:**
```
IDLE → AWAITING_REPORT → COLLECTING_REPORT → AWAITING_VALIDATION_ANSWER → 
PROVIDING_GUIDANCE → ESCALATED
         ↓
    AWAITING_KB_SEARCH
         ↓
    AWAITING_FEEDBACK_COMMENT
```

**Repository Pattern:**
- `KBDocumentRepository`: Search, create, count KB documents
- `UserReportRepository`: Create reports, update status/rating, list by user
- `ConversationRepository`: Add messages, retrieve conversation history
- `EscalationRepository`: Create escalations, update status

**Callback Router Registry Pattern:**
```python
_HANDLERS: dict[str, Callable] = {}

@register("menu:")
async def handle_menu(update, context): ...

@register("rpt:")
async def handle_report_wizard(update, context): ...
```

**EscalationData Dataclass:**
- Factory method `create()` generates UUID and timestamp
- Immutable after creation
- Formats escalation/self-service messages

**IssueClassification Dataclass:**
- Category: `data_missing`, `document_generation`, `task_sprint`, `login_auth`, `general`
- Confidence: 0.0 to 1.0
- Area: KB area for search optimization

## Entry Points

**Main Entry:**
- Location: `src/main.py`
- Triggers: `python -m src.main` or `python src/main.py`
- Responsibilities: Initialize database pool, OpenAI client, PTB application, register handlers, start polling

**Handler Registration:**
- Location: `src/bot/handlers.py` → `register_handlers()`
- Registers: CommandHandler, CallbackQueryHandler, MessageHandler

**State Dispatcher:**
- Location: `src/bot/state_handlers/__init__.py` → `dispatch()`
- Maps `ConversationState` → handler function

**Callback Router:**
- Location: `src/bot/callback_router.py` → `route_callback()`
- Dispatches by prefix to registered handlers

## Error Handling

**Strategy:** Graceful degradation with logging

**Patterns:**
- Try/except blocks with specific exception types
- Fallback to keyword classification if OpenAI fails
- Fallback to ILIKE search if tsvector not available
- Async context managers for database sessions (auto rollback on error)
- Atomic message edit + state update with try/except wrapping both

**Database Errors:**
- Session rollback on exception in `acquire()` context manager
- Warnings logged for not-found records
- Connection pool handles reconnection

## Cross-Cutting Concerns

**Logging:** Python standard logging via `setup_logger()`, configurable LOG_LEVEL

**Validation:** `IssueClassifier` and `QuestionGenerator` for input validation before processing

**Authentication:** Telegram handles auth via bot token; user_id from `update.effective_user`

**Internationalization:** All user-facing strings in `src/bot/strings.py` as constants

---

*Architecture analysis: 2026-03-31*
