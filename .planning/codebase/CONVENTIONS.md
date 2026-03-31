# Coding Conventions

**Analysis Date:** 2026-03-31

## Naming Patterns

### Files

- **Modules:** `lowercase_with_underscores.py`
  - Examples: `handlers.py`, `openai_client.py`, `conversation_manager.py`
- **Packages:** `lowercase_with_underscores/`
- **Test files:** `test_<module_name>.py`
  - Examples: `test_conversation_manager.py`, `test_validation.py`, `test_knowledge_base.py`
- **Dataclasses:** PascalCase suffix in file or same module
  - Example: `EscalationData` in `src/escalation/handler.py`

### Classes

- **PascalCase:** `ConversationManager`, `KnowledgeBaseSearcher`, `IssueClassifier`, `OpenAIClient`
- **Descriptive suffixes:** `-Manager`, `-Handler`, `-Repository`, `-Client`, `-Searcher`, `-Generator`, `-Classifier`
- **Dataclasses:** Simple nouns or noun phrases: `UserConversationState`, `IssueClassification`, `EscalationDecision`, `Question`

### Functions/Methods

- **snake_case:** `get_user_state()`, `find_relevant_articles()`, `_extract_search_terms()`, `update_user_state()`
- **Private methods:** Leading underscore `_internal_method()`
- **Async functions:** `async def` with no special prefix
- **Factory methods:** `create()` class methods: `EscalationData.create()`, `Config.from_env()`

### Variables

- **snake_case:** `user_id`, `issue_description`, `validation_answers`, `conv_manager`
- **Boolean prefixes:** `is_`, `has_`, `should_`, `enable_`, `use_`
  - Examples: `enable_reranking`, `use_hybrid`, `is_valid`, `should_escalate`
- **Constants:** `UPPER_SNAKE_CASE`
  - Examples: `STOPWORDS`, `RELATED_TERMS`, `CATEGORY_KEYWORDS`

## Code Style

### Indentation & Formatting

- **Indentation:** 4 spaces (PEP 8)
- **Line Length:** No explicit limit enforced
- **String Quotes:** Double quotes (`"`) preferred
- **Trailing Whitespace:** Removed
- **Imports:** Sorted alphabetically within groups

### Import Organization

**Order (top to bottom):**
1. Standard library imports
2. Third-party imports (telegram, openai, sqlalchemy, etc.)
3. Local application imports

**Example from `src/bot/handlers.py`:**
```python
"""Telegram command and message handlers for N1 Support Bot."""

from uuid import UUID

from telegram import Update
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler, filters

from src.database.connection import get_database_pool
from src.database.repositories import (
    ConversationRepository,
    EscalationRepository,
    KBDocumentRepository,
    UserReportRepository,
)
from src.escalation.handler import EscalationHandler
from src.rag.knowledge_base import KnowledgeBaseSearcher

from .conversation_manager import ConversationManager, ConversationState, UserConversationState
from .templates import (
    BOT_MESSAGES,
    format_acknowledge,
    format_escalation,
    ...
)
```

### Type Hints

- **Always used** on function parameters and return types
- **Collections:** `List[Type]`, `Dict[str, Type]`, `Tuple[Type, ...]`, `Optional[Type]`
- **Async:** `async def func() -> Type:`

**Example from `src/bot/conversation_manager.py`:**
```python
def get_user_state(self, user_id: int) -> UserConversationState:
    """Get current state for user, returns IDLE if no state exists."""
    ...

async def find_relevant_articles(
    self,
    issue_description: str,
    area: Optional[str] = None,
    limit: int = 5,
    use_hybrid: bool = False,
) -> List[Tuple[str, str, str]]:
```

## Docstring Conventions

### Style

- **Google-style docstrings** with type hints
- **Module docstrings:** Brief description as first line
- **Function docstrings:** Brief description, Args, Returns, optional Raises

**Example from `src/database/connection.py`:**
```python
class DatabasePool:
    """Async PostgreSQL connection pool manager.

    Provides connection pooling and session management for the database
    using SQLAlchemy async engine with asyncpg driver.

    Attributes:
        database_url: PostgreSQL connection string.
        engine: SQLAlchemy async engine instance.
        session_factory: Session factory for creating database sessions.
    """

    async def acquire(self) -> AsyncGenerator[AsyncSession, None]:
        """Acquire a database session from the pool.

        Yields:
            AsyncSession: Database session for executing queries.

        Raises:
            RuntimeError: If pool is not initialized.
        """
        ...
```

**Function docstring from `src/escalation/handler.py`:**
```python
async def create_escalation(
    self,
    report_id: str,
    summary: str,
    project_name: Optional[str] = None,
    impact: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> EscalationData:
    """Create an escalation record and update the associated user report status.

    Args:
        report_id: The ID of the user report to escalate.
        summary: Brief description of the issue.
        project_name: Optional name of the project related to the issue.
        impact: Optional description of how the issue affects the user.
        assigned_to: Optional agent ID to assign the escalation to.

    Returns:
        The created EscalationData instance.

    Raises:
        ValueError: If the report_id is not found in user_report_repo.
    """
```

## Error Handling

### Exception Patterns

**Basic try/except with logging:**
```python
# From src/utils/openai_client.py
try:
    response = self.client.chat.completions.create(...)
    return response.choices[0].message.content
except Exception as e:
    logger.error(f"OpenAI API error: {e}")
    raise
```

**Database session with rollback:**
```python
# From src/database/connection.py
async with self.session_factory() as session:
    try:
        yield session
    except Exception as e:
        await session.rollback()
        logger.error(f"Database session error: {e}")
        raise
```

**Validation patterns:**
```python
# From src/config.py
def validate(self) -> bool:
    """Validate required configuration."""
    if not self.telegram_bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN is required")
    if not self.openai_api_key:
        raise ValueError("OPENAI_API_KEY is required")
    return True
```

**Graceful degradation with fallbacks:**
```python
# From src/rag/knowledge_base.py
try:
    async with self.db_pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
except Exception:
    # Fallback sem tsvector caso a coluna ainda não exista
    rows = await self._fetch_ilike_only(search_terms, area, limit)
```

## Logging

### Logger Setup

**Module-level logger pattern:**
```python
# From src/database/connection.py
import logging

logger = logging.getLogger(__name__)
```

**Logger utility from `src/utils/logger.py`:**
```python
def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Configure and return a logger with structured output."""
    log_level = level or "INFO"
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    
    if not logger.handlers:
        logger.addHandler(handler)
    
    return logger
```

**Usage:**
```python
logger.info("Database pool initialized successfully")
logger.warning(f"Report not found for status update: {report_id}")
logger.error(f"Database session error: {e}")
```

## Common Patterns

### Dataclass Pattern

```python
# From src/bot/conversation_manager.py
@dataclass
class UserConversationState:
    """Stores the conversation state for a specific user."""
    state: ConversationState
    user_id: int
    current_report_id: Optional[str] = None
    issue_description: Optional[str] = None
    validation_questions: List[dict] = field(default_factory=list)
```

### Factory Method Pattern

```python
# From src/escalation/handler.py
@classmethod
def create(
    cls,
    user_report_id: str,
    summary: str,
    project_name: Optional[str] = None,
    ...
) -> "EscalationData":
    """Factory method to create a new escalation with generated ID and timestamp."""
    return cls(
        id=str(uuid4()),
        user_report_id=user_report_id,
        ...
    )
```

### Repository Pattern

```python
# From src/database/repositories.py
class KBDocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(self, query: str, area: Optional[str] = None, limit: int = 5) -> List[KBDocument]:
        stmt = select(KBDocument).where(...)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
```

### Async Context Manager Pattern

```python
# From src/bot/handlers.py
async with pool.acquire() as session:
    user_report_repo = UserReportRepository(session)
    report = await user_report_repo.create(
        description=issue_description,
        user_id=UUID(int=user_id) if user_id else None,
    )
```

### Enum Pattern

```python
# From src/bot/conversation_manager.py
class ConversationState(Enum):
    """Enumeration of possible conversation states."""
    IDLE = "idle"
    AWAITING_REPORT = "awaiting_report"
    AWAITING_VALIDATION_ANSWER = "awaiting_validation_answer"
    PROVIDING_GUIDANCE = "providing_guidance"
    ESCALATED = "escalated"
```

### Global Singleton Pattern

```python
# From src/bot/handlers.py
conv_manager = ConversationManager()  # Global instance

# From src/database/connection.py
_pool: Optional[DatabasePool] = None

def get_database_pool() -> DatabasePool:
    """Get the global database pool instance."""
    global _pool
    if _pool is None:
        _pool = DatabasePool(DATABASE_URL)
    return _pool
```

## Module Structure

### Package Organization

```
src/
├── bot/                    # Telegram handlers and UI
│   ├── __init__.py
│   ├── handlers.py         # Command handlers
│   ├── conversation_manager.py
│   ├── templates.py        # Message formatting
│   ├── keyboards.py        # Inline keyboard definitions
│   ├── strings.py          # Message constants
│   ├── state_handlers/     # State-specific handlers
│   └── callback_router.py   # Callback routing
├── database/               # Data access layer
│   ├── __init__.py
│   ├── connection.py       # Pool management
│   ├── models.py           # SQLAlchemy models
│   └── repositories.py     # Data repositories
├── rag/                    # RAG functionality
│   ├── __init__.py
│   ├── knowledge_base.py   # Search and retrieval
│   └── embeddings.py       # Vector embeddings
├── validation/            # Issue validation
│   ├── __init__.py
│   ├── classifier.py       # Issue classification
│   └── questions.py        # Validation questions
├── escalation/            # Human handoff
│   ├── __init__.py
│   └── handler.py         # Escalation logic
├── utils/                 # Utilities
│   ├── __init__.py
│   ├── openai_client.py   # LLM client
│   └── logger.py          # Logging setup
└── config.py              # Configuration dataclass
```

---

*Convention analysis: 2026-03-31*
