# RAG Workforce Codebase Conventions

## Code Style

### Indentation & Formatting
- **Indentation**: 4 spaces (PEP 8)
- **Line Length**: No explicit limit enforced, but code uses reasonable line wrapping
- **String Quotes**: Double quotes (`"`) preferred in most contexts
- **Trailing Whitespace**: Removed

### Examples from codebase:
```python
# From src/config.py
@dataclass
class Config:
    # Required
    telegram_bot_token: str
    openai_api_key: str
    database_url: str

    # Optional
    openai_model: str = "MiniMax-M2"
    rag_schema: str = "rag"
```

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
```python
# From src/rag/knowledge_base.py
class KnowledgeBaseSearcher:
    def __init__(self, db_pool, embedding_generator=None, openai_client=None, enable_reranking=False):
        self.db_pool = db_pool
        self.embedding_generator = embedding_generator
        self.openai_client = openai_client
        self.enable_reranking = enable_reranking

    async def find_relevant_articles(self, issue_description: str, area=None, limit: int = 5):
        search_terms = self._extract_search_terms(issue_description)
        expanded_terms = self._expand_query_terms(search_terms)
        candidates = await self._bm25_search(expanded_terms, area, limit * 3)
```

## Import Organization

### Structure (top to bottom):
1. Standard library imports (one per line if multiple)
2. Third-party imports
3. Local application imports
4. Relative imports within package

### Example from `src/bot/handlers.py`:
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
from src.validation.classifier import IssueClassifier
from src.validation.questions import QuestionGenerator

from .conversation_manager import ConversationManager, ConversationState, UserConversationState
from .templates import (
    BOT_MESSAGES,
    format_acknowledge,
    format_escalation,
    format_self_service,
    format_validation_question,
    format_status_report,
    format_search_results,
    format_feedback,
    format_report_list,
    get_confirmation_keyboard,
)
```

### Multi-line imports:
- Use parentheses with items on separate lines
- One import per line or logical grouping by module

## Docstring Conventions

### Style
- **Google-style docstrings** with type hints
- **Module docstrings**: Module purpose as first line
- **Function/Method docstrings**: Brief description, Args, Returns, optional Raises

### Example from `src/database/repositories.py`:
```python
async def search(
    self,
    query: str,
    area: Optional[str] = None,
    limit: int = 5
) -> List[KBDocument]:
    """Search documents by keyword using ILIKE.

    Performs a case-insensitive search on title and content fields.

    Args:
        query: Search query string.
        area: Optional area to filter by.
        limit: Maximum number of results to return.

    Returns:
        List of matching KBDocument objects.
    """
```

### Class docstrings:
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
```

## Type Hints

### Usage:
- **Always used** on function parameters and return types
- **Optional used**: `Optional[Type]` from typing module
- **Collections**: `List[Type]`, `Dict[str, Type]`, `Tuple[Type, ...]`
- **Async**: `async def func() -> Type:`

### Example from `src/rag/knowledge_base.py`:
```python
async def find_relevant_articles(
    self,
    issue_description: str,
    area: Optional[str] = None,
    limit: int = 5,
    use_hybrid: bool = False
) -> List[Tuple[str, str, str]]:
```

## Error Handling Patterns

### Exception Handling:
1. **Specific exceptions first**: Catch specific errors before general ones
2. **Logging before raising**: Always log context before re-raising
3. **Context preservation**: Maintain error context with `raise` (no argument)

### Example from `src/utils/openai_client.py`:
```python
try:
    response = self.client.chat.completions.create(
        model=self.model,
        messages=messages,
        temperature=temperature,
        **kwargs
    )
    return response.choices[0].message.content
except Exception as e:
    logger.error(f"OpenAI API error: {e}")
    raise
```

### Validation pattern from `src/config.py`:
```python
def validate(self) -> bool:
    """Validate required configuration."""
    if not self.telegram_bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN is required")
    if not self.openai_api_key:
        raise ValueError("OPENAI_API_KEY is required")
    return True
```

### Database error handling from `src/database/connection.py`:
```python
@asynccontextmanager
async def acquire(self) -> AsyncGenerator[AsyncSession, None]:
    """Acquire a database session from the pool."""
    if self.session_factory is None:
        raise RuntimeError("Database pool not initialized. Call initialize() first.")
    
    async with self.session_factory() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
```

## Logging Patterns

### Logger Setup:
- **Module-level logger**: `logger = setup_logger(__name__)` at module top
- **Log level**: Respects `LOG_LEVEL` environment variable
- **Format**: Timestamp - Module name - Level - Message

### Usage pattern from `src/database/connection.py`:
```python
import logging
logger = logging.getLogger(__name__)

# In methods:
logger.info("Database pool initialized successfully")
logger.error(f"Database session error: {e}")

# In functions:
logger.info("Shutting down...")
logger.info("Shutdown complete.")
```

### Logger utility from `src/utils/logger.py`:
```python
def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Configure and return a logger with structured output."""
    log_level = level or "INFO"
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    # ... formatter setup ...
    return logger
```

## Common Code Patterns

### Async Context Managers (Database Sessions):
```python
# From src/bot/handlers.py
async with pool.acquire() as session:
    user_report_repo = UserReportRepository(session)
    report = await user_report_repo.create(
        description=issue_description,
        user_id=UUID(int=user_id) if user_id else None,
    )
```

### Repository Pattern:
```python
# From src/database/repositories.py
class KBDocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
    
    async def search(self, query: str, area=None, limit: int = 5):
        stmt = select(KBDocument).where(
            (KBDocument.title.ilike(f"%{query}%")) |
            (KBDocument.content.ilike(f"%{query}%"))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
```

### Dataclass Usage:
```python
# From src/validation/classifier.py
@dataclass
class IssueClassification:
    """Classification result for a user-reported issue."""
    category: str
    confidence: float
    summary: str
    area: str
```

### State Management:
```python
# From src/bot/conversation_manager.py
def get_user_state(self, user_id: int) -> UserConversationState:
    """Get conversation state for a user."""
    if user_id not in self._states:
        self._states[user_id] = UserConversationState(
            state=ConversationState.IDLE,
            user_id=user_id
        )
    return self._states[user_id]
```

### Configuration Loading:
```python
# From src/config.py
@classmethod
def from_env(cls) -> "Config":
    """Load configuration from environment variables."""
    return cls(
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        database_url=os.getenv("DATABASE_URL", "postgresql://..."),
    )

def validate(self) -> bool:
    """Validate required configuration."""
    if not self.telegram_bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN is required")
    return True
```

## Project Structure

```
src/
├── __init__.py
├── config.py                    # Configuration management
├── main.py                      # Entry point
├── bot/                         # Telegram bot handlers
│   ├── __init__.py
│   ├── handlers.py              # Command and message handlers
│   ├── conversation_manager.py  # State management
│   └── templates.py             # Message formatting
├── database/                    # Data access layer
│   ├── __init__.py
│   ├── connection.py            # Connection pooling
│   ├── models.py                # SQLAlchemy ORM models
│   └── repositories.py          # Repository pattern classes
├── rag/                         # RAG/Knowledge Base
│   ├── __init__.py
│   ├── knowledge_base.py        # BM25 search with hybrid ranking
│   └── embeddings.py            # Embedding generation
├── validation/                  # Issue validation
│   ├── __init__.py
│   ├── classifier.py            # Issue classification
│   └── questions.py             # Validation questions
├── escalation/                  # Escalation handling
│   ├── __init__.py
│   └── handler.py               # Escalation logic
└── utils/                       # Utilities
    ├── __init__.py
    ├── logger.py                # Logging setup
    └── openai_client.py         # OpenAI/MiniMax client
```

## Key Design Principles Applied

1. **Single Responsibility**: Each class handles one concern (Repository, Handler, Manager, Searcher)
2. **Dependency Injection**: Pass dependencies via constructor (db_pool, openai_client, etc.)
3. **Async/Await**: Consistent use of async patterns for I/O operations
4. **Type Safety**: Extensive use of type hints for code clarity
5. **Clear Separation**: Business logic, data access, and presentation are separated
6. **Error Context**: Errors include meaningful context for debugging
7. **Environment Configuration**: All secrets/config via environment variables
8. **Docstring First**: Public APIs documented with comprehensive docstrings
