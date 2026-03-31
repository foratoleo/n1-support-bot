# Directory and File Structure

**Last Updated:** 2026-03-30  
**Status:** N1 Support Bot - Phase 2

## Project Directory Tree

```
ragworkforce/
├── src/                                    # Main source code directory
│   ├── __init__.py                         # Package initialization
│   ├── main.py                             # Application entry point
│   ├── config.py                           # Configuration management
│   │
│   ├── bot/                                # Telegram bot layer
│   │   ├── __init__.py
│   │   ├── handlers.py                     # Command handlers (/report, /search, /feedback, etc.)
│   │   ├── conversation_manager.py         # Per-user state management
│   │   └── templates.py                    # Message formatting and UI templates
│   │
│   ├── database/                           # Data access layer
│   │   ├── __init__.py
│   │   ├── connection.py                   # Database pool and connection management
│   │   ├── models.py                       # SQLAlchemy ORM models
│   │   └── repositories.py                 # Repository pattern for CRUD operations
│   │
│   ├── rag/                                # Retrieval-Augmented Generation
│   │   ├── __init__.py
│   │   ├── knowledge_base.py               # KB search with BM25 ranking
│   │   └── embeddings.py                   # Embedding generation (optional pgvector)
│   │
│   ├── escalation/                         # Escalation management
│   │   ├── __init__.py
│   │   └── handler.py                      # Escalation workflow and message formatting
│   │
│   ├── validation/                         # Issue validation and classification
│   │   ├── __init__.py
│   │   ├── classifier.py                   # Issue classification and escalation decision
│   │   └── questions.py                    # Validation question generation
│   │
│   └── utils/                              # Utilities
│       ├── __init__.py
│       ├── logger.py                       # Logging configuration
│       └── openai_client.py                # OpenAI/MiniMax API wrapper
│
├── scripts/                                # Utility scripts
│   └── seed_kb.py                          # Knowledge base population script
│
├── tests/                                  # Test suite
│   ├── __init__.py
│   ├── conftest.py                         # pytest configuration and fixtures
│   ├── test_conversation_manager.py
│   ├── test_escalation_handler.py
│   ├── test_knowledge_base.py
│   ├── test_models.py
│   ├── test_repositories.py
│   ├── test_templates.py
│   └── test_validation.py
│
├── supabase/                               # Supabase Edge Functions (external services)
│   └── functions/                          # Serverless functions for file processing
│       ├── accessibility-test/
│       ├── extract-pdf/
│       ├── generate-presigned-download-url/
│       ├── process-transcript/
│       ├── recall-bot-create/
│       ├── recall-bot-list/
│       ├── recall-transcript/
│       ├── recall-webhook/
│       ├── service-call-to-markdown/
│       ├── llms.txt
│       └── llms-full.txt
│
├── docs/                                   # Documentation (project context)
│   ├── 01-project-overview/
│   ├── 02-folder-structure/
│   ├── 03-glossary/
│   ├── 04-database-schema/
│   ├── 05-authentication/
│   ├── ...
│   └── [20+ subdirectories for feature docs]
│
├── .planning/                              # Planning and analysis artifacts
│   └── codebase/
│       ├── ARCHITECTURE.md                 # This architecture document
│       └── STRUCTURE.md                    # This structure document
│
├── docker-compose.yml                      # Docker Compose configuration
├── requirements.txt                        # Python dependencies
└── .gitignore                              # Git ignore rules
```

---

## File Location Quick Reference

### Core Application Files

| File | Purpose | Type |
|------|---------|------|
| `src/main.py` | Application entry point, bot initialization | Entry Point |
| `src/config.py` | Configuration loading and validation | Configuration |
| `src/bot/handlers.py` | Telegram command handlers | Business Logic |
| `src/bot/conversation_manager.py` | User state management | State Management |
| `src/bot/templates.py` | Message templates and formatting | UI/Presentation |

### Database Files

| File | Purpose | Type |
|------|---------|------|
| `src/database/connection.py` | Database pool, session management | Infrastructure |
| `src/database/models.py` | SQLAlchemy ORM model definitions | Data Model |
| `src/database/repositories.py` | CRUD repository classes | Data Access |

### Business Logic Files

| File | Purpose | Type |
|------|---------|------|
| `src/rag/knowledge_base.py` | KB search, BM25 ranking, query expansion | Search/Retrieval |
| `src/rag/embeddings.py` | Vector embedding generation (optional) | AI/ML |
| `src/escalation/handler.py` | Escalation workflow, message formatting | Business Logic |
| `src/validation/classifier.py` | Issue classification, escalation decision | Business Logic |
| `src/validation/questions.py` | Validation question generation | Business Logic |

### Utility Files

| File | Purpose | Type |
|------|---------|------|
| `src/utils/openai_client.py` | OpenAI/MiniMax API wrapper | Infrastructure |
| `src/utils/logger.py` | Logging configuration | Utilities |

### Testing Files

| File | Coverage | Type |
|------|----------|------|
| `tests/conftest.py` | pytest fixtures, mocks | Test Infrastructure |
| `tests/test_conversation_manager.py` | ConversationManager, state transitions | Unit Tests |
| `tests/test_escalation_handler.py` | Escalation creation, status updates | Unit Tests |
| `tests/test_knowledge_base.py` | BM25 search, query expansion, deduplication | Unit Tests |
| `tests/test_models.py` | ORM model validation | Unit Tests |
| `tests/test_repositories.py` | CRUD operations, repository patterns | Unit Tests |
| `tests/test_templates.py` | Message formatting, template rendering | Unit Tests |
| `tests/test_validation.py` | Classification, escalation decision logic | Unit Tests |

### Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `requirements.txt` | Python package dependencies | pip format |
| `docker-compose.yml` | Docker Compose services | YAML |
| `.gitignore` | Git ignore patterns | Text |

---

## Naming Conventions

### File Naming

| Category | Convention | Example |
|----------|-----------|---------|
| **Modules** | lowercase_with_underscores | `conversation_manager.py` |
| **Packages** | lowercase | `src/bot/` |
| **Test Files** | `test_<module_name>.py` | `test_escalation_handler.py` |
| **Scripts** | lowercase_with_underscores | `seed_kb.py` |

### Class Naming

| Category | Convention | Example |
|----------|-----------|---------|
| **Classes** | PascalCase | `ConversationManager` |
| **Data Classes** | PascalCase | `UserConversationState` |
| **Enums** | PascalCase | `ConversationState` |
| **Exceptions** | PascalCase (ends with Error) | `ValidationError` |

### Function/Method Naming

| Category | Convention | Example |
|----------|-----------|---------|
| **Public Methods** | lowercase_with_underscores | `find_relevant_articles()` |
| **Private Methods** | _lowercase_with_underscores | `_extract_search_terms()` |
| **Async Methods** | lowercase_with_underscores (prefix with async) | `async def classify()` |
| **Handler Functions** | <action>_command or <action>_handler | `report_command()`, `message_handler()` |

### Variable Naming

| Category | Convention | Example |
|----------|-----------|---------|
| **Constants** | UPPER_SNAKE_CASE | `STOPWORDS`, `RELATED_TERMS` |
| **Flags/Booleans** | lowercase_with_underscores (use `is_`, `has_`, `can_`) | `is_escalated`, `has_solution` |
| **Instances** | lowercase_with_underscores | `session`, `user_state`, `kb_searcher` |

### Database Naming

| Category | Convention | Example |
|----------|-----------|---------|
| **Schemas** | lowercase | `rag` |
| **Tables** | lowercase_plural | `kb_documents`, `user_reports` |
| **Columns** | lowercase_with_underscores | `user_id`, `created_at` |
| **Foreign Keys** | <referenced_table>_id | `user_report_id` |

---

## Module Organization

### Layered Architecture Breakdown

```
Presentation Layer
├── src/bot/handlers.py          ← Command handlers, update routing
├── src/bot/conversation_manager.py  ← State transitions
└── src/bot/templates.py         ← Message formatting
                                 ↓
Business Logic Layer
├── src/validation/classifier.py      ← Classification logic
├── src/escalation/handler.py         ← Escalation workflow
└── src/validation/questions.py       ← Question generation
                                 ↓
RAG & Search Layer
├── src/rag/knowledge_base.py         ← BM25 + vector search
└── src/rag/embeddings.py        ← Embedding generation
                                 ↓
Data Access Layer
├── src/database/repositories.py  ← CRUD operations
└── src/database/models.py        ← ORM definitions
                                 ↓
Infrastructure Layer
├── src/database/connection.py    ← Connection pooling
├── src/config.py                 ← Configuration
├── src/utils/openai_client.py    ← API wrappers
└── src/utils/logger.py           ← Logging
```

### Dependency Flow (Upward)

```
main.py (orchestrator)
  ├→ config.py (settings)
  ├→ bot/handlers.py (presentation)
  │  └→ bot/conversation_manager.py (state)
  │     └→ database/repositories.py (data access)
  │        └→ database/connection.py (infrastructure)
  ├→ escalation/handler.py (business logic)
  │  └→ database/repositories.py
  ├→ validation/classifier.py (business logic)
  │  └→ rag/knowledge_base.py (search)
  │     └→ database/repositories.py
  ├→ utils/openai_client.py (infrastructure)
  └→ utils/logger.py (infrastructure)
```

---

## Key Directories Explained

### `src/` - Main Source Code
Central location for all application logic, organized by concern (bot, database, RAG, etc.). All Python packages must have `__init__.py` files.

### `src/bot/` - Telegram Bot Interface
Handles user interactions through Telegram. Contains:
- Command parsing and routing
- Conversation state machine
- Message templates (for consistency)

### `src/database/` - Data Persistence
Manages all database operations:
- Connection pooling with SQLAlchemy
- ORM models (KBDocument, UserReport, Conversation, Escalation)
- Repository pattern for clean data access

### `src/rag/` - Search and Retrieval
Implements knowledge base search:
- BM25 ranking with query expansion
- Optional vector embeddings (pgvector)
- Optional GPT-4o re-ranking

### `src/escalation/` - Issue Escalation
Handles escalation to human agents:
- Escalation record creation
- Status tracking
- Message formatting

### `src/validation/` - Issue Analysis
Validates and classifies issues:
- Issue classification (5 categories)
- Escalation decision logic
- Question generation for validation

### `src/utils/` - Shared Utilities
Cross-cutting concerns:
- OpenAI API wrapper (MiniMax-compatible)
- Logging configuration

### `tests/` - Test Suite
Unit and integration tests:
- pytest + pytest-asyncio framework
- Fixtures in `conftest.py`
- One test file per module

### `scripts/` - Utility Scripts
Ad-hoc maintenance and setup:
- `seed_kb.py`: Populate knowledge base from files

### `docs/` - Documentation
Project context and specifications (20+ documents):
- Database schema, authentication, routing
- Component organization, state management
- Feature-specific documentation

### `supabase/functions/` - Serverless Functions
External services for specialized tasks:
- PDF extraction
- Transcript processing
- Webhook handlers
- Presigned URL generation

---

## Import Patterns

### Standard Imports by Layer

**Presentation Layer** (`src/bot/`)
```python
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler

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
from .conversation_manager import ConversationManager, ConversationState
from .templates import BOT_MESSAGES, format_escalation
```

**Business Logic Layer** (`src/validation/`, `src/escalation/`)
```python
from dataclasses import dataclass
from typing import Optional, List
from src.database.repositories import EscalationRepository, UserReportRepository
from .questions import QuestionGenerator
```

**Data Access Layer** (`src/database/`)
```python
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Conversation, Escalation, KBDocument, UserReport
```

**Infrastructure Layer** (`src/utils/`, `src/config.py`)
```python
from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import logging
from dotenv import load_dotenv
```

### Relative vs Absolute Imports

| Context | Convention | Example |
|---------|-----------|---------|
| **Within same package** | Relative with `.` | `from .conversation_manager import ConversationManager` |
| **Cross-package** | Absolute from `src/` | `from src.database.connection import get_database_pool` |
| **Test files** | Absolute from `src/` | `from src.bot.handlers import report_command` |

---

## Database Schema Layout

**Schema:** `rag` (PostgreSQL)

**Tables:**
```
rag.kb_documents
  ├─ id (UUID, PK)
  ├─ area (TEXT)
  ├─ title (TEXT)
  ├─ content (TEXT)
  ├─ file_path (TEXT, UNIQUE)
  ├─ created_at (DATETIME)
  └─ embedding (VECTOR, optional pgvector)

rag.user_reports
  ├─ id (UUID, PK)
  ├─ user_id (UUID, nullable)
  ├─ project_id (UUID, nullable)
  ├─ description (TEXT)
  ├─ status (TEXT)
  ├─ rating (TEXT, nullable)
  └─ created_at (DATETIME)

rag.conversations
  ├─ id (UUID, PK)
  ├─ user_report_id (UUID, FK → user_reports.id)
  ├─ role (TEXT)
  ├─ message (TEXT)
  └─ created_at (DATETIME)

rag.escalations
  ├─ id (UUID, PK)
  ├─ user_report_id (UUID, FK → user_reports.id)
  ├─ summary (TEXT)
  ├─ project_name (TEXT, nullable)
  ├─ impact (TEXT, nullable)
  ├─ assigned_to (UUID, nullable)
  ├─ status (TEXT)
  └─ created_at (DATETIME)
```

---

## Configuration Files

### `requirements.txt`
Python package dependencies with pinned or minimum versions. Installed via `pip install -r requirements.txt`.

**Categories:**
- **Core:** telegram-bot, openai, sqlalchemy, asyncpg
- **Utilities:** python-dotenv, pydantic, httpx
- **Testing:** pytest, pytest-asyncio, pytest-mock, pytest-cov
- **Optional:** rank-bm25, nltk, redis, pgvector

### `docker-compose.yml`
Services for local development:
- PostgreSQL database
- Optional Redis cache
- Optional pgvector extension

### `.gitignore`
Standard Python ignores:
- `__pycache__/`, `.pytest_cache/`
- `.venv/`, `venv/`
- `.env`, `.env.local`
- IDE files (`.vscode/`, `.idea/`)

---

## Line Counts and Statistics

### Code Files Summary

| Module | File | Lines | Type |
|--------|------|-------|------|
| **Main** | `src/main.py` | 63 | Entry Point |
| **Config** | `src/config.py` | 42 | Configuration |
| **Bot** | `src/bot/handlers.py` | 500+ | Business Logic |
| **Bot** | `src/bot/conversation_manager.py` | 80 | State Management |
| **Bot** | `src/bot/templates.py` | 200+ | Templates |
| **Database** | `src/database/connection.py` | 186 | Infrastructure |
| **Database** | `src/database/models.py` | 143 | Data Model |
| **Database** | `src/database/repositories.py` | 420 | Data Access |
| **RAG** | `src/rag/knowledge_base.py` | 556 | Search/Retrieval |
| **RAG** | `src/rag/embeddings.py` | ~100 | AI/ML |
| **Escalation** | `src/escalation/handler.py` | 211 | Business Logic |
| **Validation** | `src/validation/classifier.py` | 379 | Business Logic |
| **Validation** | `src/validation/questions.py` | ~150 | Business Logic |
| **Utils** | `src/utils/openai_client.py` | 79 | Infrastructure |
| **Utils** | `src/utils/logger.py` | ~50 | Utilities |

**Total Source Lines of Code (SLOC):** ~3,500+

### Test Files Summary

| File | Coverage |
|------|----------|
| `tests/test_conversation_manager.py` | ConversationManager |
| `tests/test_escalation_handler.py` | EscalationHandler |
| `tests/test_knowledge_base.py` | KnowledgeBaseSearcher, BM25 |
| `tests/test_models.py` | ORM models |
| `tests/test_repositories.py` | Repository classes |
| `tests/test_templates.py` | Message templates |
| `tests/test_validation.py` | Classifier, escalation decision |

---

## Execution Flow (From File Perspective)

```
$ python -m src.main

1. src/main.py::main()
   ├─ Load src/config.py → Config.from_env()
   ├─ Initialize src/database/connection.py → DatabasePool
   ├─ Create src/utils/openai_client.py → OpenAIClient
   ├─ Register handlers from src/bot/handlers.py
   │  ├─ report_command → creates UserReport
   │  ├─ validation_handler → uses src/validation/classifier.py
   │  ├─ escalation_handler → uses src/escalation/handler.py
   │  └─ feedback_handler → updates rating
   │
   └─ Start polling src/telegram.ext.Application
      └─ Message arrives
         └─ src/bot/handlers.py::message_handler()
            ├─ src/bot/conversation_manager.py → get/update state
            ├─ src/database/repositories.py → fetch/store data
            ├─ src/rag/knowledge_base.py → search KB
            ├─ src/validation/classifier.py → classify issue
            ├─ src/escalation/handler.py → handle escalation
            └─ src/utils/openai_client.py → call LLM
               └─ Response via Telegram
```

---

## Summary Statistics

- **Total Python Files:** 20+ source files
- **Total Directories:** 8 main + 20+ docs subdirectories
- **Database Tables:** 4 (KBDocument, UserReport, Conversation, Escalation)
- **External APIs:** 2 (Telegram, OpenAI/MiniMax)
- **Layers:** 6 (Presentation, Business Logic, RAG, Data, Config, Infrastructure)
- **Test Coverage:** 7+ test modules

