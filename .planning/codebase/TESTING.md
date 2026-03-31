# RAG Workforce Testing Guide

## Test Framework

### Core Testing Stack
- **Framework**: pytest (>=8.3.0)
- **Async Support**: pytest-asyncio (>=0.25.0)
- **Mocking**: pytest-mock (>=3.14.0), unittest.mock
- **Coverage**: pytest-cov (>=6.0.0)

### Dependencies from `requirements.txt`:
```
pytest>=8.3.0
pytest-asyncio>=0.25.0
pytest-cov>=6.0.0
pytest-mock>=3.14.0
```

## Test File Organization

### Location & Naming Convention
- **Location**: `tests/` directory at project root
- **Naming**: `test_<module>.py` (e.g., `test_knowledge_base.py`, `test_validation.py`)
- **Import pattern**: Relative imports with `sys.path` adjustment for source modules

### Test File Structure:
```
tests/
├── __init__.py
├── conftest.py                      # Pytest fixtures and configuration
├── test_conversation_manager.py
├── test_escalation_handler.py
├── test_knowledge_base.py
├── test_models.py
├── test_repositories.py
├── test_templates.py
└── test_validation.py
```

## Test Class Organization

### Pattern: One Test Class Per Component
```python
# From tests/test_knowledge_base.py
class TestExtractSearchTerms:
    """Tests for _extract_search_terms method."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_basic_term_extraction(self):
        """Test basic term extraction removes stopwords."""
        text = "The user cannot login to the system"
        terms = self.searcher._extract_search_terms(text)
        
        assert 'the' not in terms
        assert 'user' not in terms  # removed by stopwords
        assert 'cannot' in terms
        assert 'login' in terms
        assert 'system' in terms
```

### Key patterns:
- **Class per method/feature**: Group related test methods in classes
- **Descriptive class names**: `TestExtractSearchTerms`, `TestConversationState`, `TestQueryExpansion`
- **setup_method()**: Initialize fixtures for each test method
- **Docstrings**: Every class and test has descriptive docstring

## Fixtures and Mocking

### Shared Fixtures (`tests/conftest.py`):
```python
import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock

@pytest.fixture
def mock_db_pool():
    """Mock database pool for unit tests."""
    pool = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = AsyncMock()
    pool.acquire.return_value.__aexit__.return_value = None
    return pool

@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client for unit tests."""
    client = MagicMock()
    client.chat.completion.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Test response"))]
    )
    return client

@pytest.fixture
def sample_issue_description():
    """Sample user issue for testing."""
    return "I cannot find my task in the sprint board"

@pytest.fixture
def sample_kb_article():
    """Sample knowledge base article."""
    return ("Task not visible in sprint",
            "If a task is not showing in the sprint board, check if the task has been assigned to the sprint and that the sprint is active.",
            "planning")
```

### Fixture Usage:
```python
# From tests/test_conversation_manager.py
class TestConversationManager:
    @pytest.fixture
    def manager(self):
        """Create a fresh ConversationManager instance."""
        return ConversationManager()

    def test_get_user_state_new_user(self, manager):
        """Test getting state for a new user returns IDLE."""
        state = manager.get_user_state(123)
        
        assert state.state == ConversationState.IDLE
        assert state.user_id == 123
```

## Mocking Patterns

### Import Mocking:
```python
# From tests/test_knowledge_base.py
from unittest.mock import AsyncMock, MagicMock, patch

# Local imports with sys.path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from rag.knowledge_base import KnowledgeBaseSearcher, STOPWORDS, RELATED_TERMS
```

### Mock Database Session:
```python
# Synchronous mock
def test_with_mock_db():
    mock_db = MagicMock()
    searcher = KnowledgeBaseSearcher(db_pool=mock_db)
    # Test code...

# Asynchronous mock
mock_db_pool = AsyncMock()
mock_db_pool.acquire.return_value.__aenter__.return_value = AsyncMock()
```

### Mock OpenAI Client:
```python
# From actual code patterns
mock_client = MagicMock()
mock_client.chat.completions.create.return_value = MagicMock(
    choices=[MagicMock(message=MagicMock(content="response"))]
)
classifier = IssueClassifier(
    openai_client=mock_client,
    kb_searcher=kb_searcher,
    question_generator=question_generator,
)
```

## Test Naming Conventions

### Test Method Names:
- **Pattern**: `test_<what_is_being_tested>_<expected_behavior>`
- **Examples**:
  - `test_basic_term_extraction`
  - `test_multilanguage_stopwords`
  - `test_duplicate_title_removed`
  - `test_get_user_state_new_user`
  - `test_get_user_state_same_user_returns_same_state`

### Docstring Pattern:
```python
def test_basic_term_extraction(self):
    """Test basic term extraction removes stopwords."""
    # Test code...

def test_multilanguage_stopwords(self):
    """Test stopwords from multiple languages are removed."""
    # Test code...
```

## Test Coverage Examples

### Unit Tests: BM25 Ranking (`tests/test_knowledge_base.py`)
```python
class TestBM25Scoring:
    """Tests for BM25 scoring calculations."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())
        self.searcher._doc_stats_cache = 100
        self.searcher._avg_doc_length = 500

    def test_title_weight(self):
        """Test title matches score higher than content matches."""
        score1 = self.searcher._calculate_bm25_score(
            'Login page', 'User cannot access the login page', ['login'], 50
        )
        # Assertions...
```

### Unit Tests: Query Expansion
```python
class TestExpandQueryTerms:
    """Tests for query expansion."""

    def setup_method(self):
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_direct_expansion(self):
        """Test direct related term expansion."""
        terms = ['login']
        expanded = self.searcher._expand_query_terms(terms)
        
        assert 'login' in expanded
        assert 'signin' in expanded
        assert 'password' in expanded
        assert 'credential' in expanded

    def test_auth_related_expansion(self):
        """Test authentication-related term expansion."""
        terms = ['password', 'session']
        expanded = self.searcher._expand_query_terms(terms)
        
        # Password related
        assert 'password' in expanded
        assert 'credential' in expanded
        # Session related
        assert 'session' in expanded
        assert 'token' in expanded
```

### Unit Tests: Conversation State (`tests/test_conversation_manager.py`)
```python
class TestConversationState:
    """Tests for ConversationState enum."""

    def test_all_states_exist(self):
        """Test that all expected states are defined."""
        states = [s.value for s in ConversationState]
        expected = ["idle", "awaiting_report", "awaiting_validation_answer", 
                   "providing_guidance", "escalated"]
        for state in expected:
            assert state in states

class TestUserConversationState:
    """Tests for UserConversationState dataclass."""

    def test_default_initialization(self):
        """Test UserConversationState with default values."""
        state = UserConversationState(
            state=ConversationState.IDLE,
            user_id=123
        )
        
        assert state.state == ConversationState.IDLE
        assert state.user_id == 123
        assert state.current_report_id is None
        assert state.validation_questions == []
```

## Test Patterns

### Assertion Patterns:
```python
# Direct assertion
assert len(deduped) == 2

# Membership testing
assert 'login' in expanded
assert 'the' not in terms

# Exception testing (implicit via fixture setup)
with pytest.raises(ValueError, match="TELEGRAM_BOT_TOKEN is required"):
    config = Config(telegram_bot_token="")
    config.validate()
```

### Setup and Teardown:
```python
class TestSomething:
    def setup_method(self):
        """Run before each test method."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())
    
    # Teardown automatically via pytest cleanup
```

## Running Tests

### Run All Tests:
```bash
pytest tests/
```

### Run Specific Test File:
```bash
pytest tests/test_knowledge_base.py
```

### Run Specific Test Class:
```bash
pytest tests/test_knowledge_base.py::TestExtractSearchTerms
```

### Run Specific Test Method:
```bash
pytest tests/test_knowledge_base.py::TestExtractSearchTerms::test_basic_term_extraction
```

### Run with Coverage:
```bash
pytest tests/ --cov=src --cov-report=html
```

### Run with Verbose Output:
```bash
pytest tests/ -v
```

### Run Async Tests:
```bash
pytest tests/ --asyncio-mode=auto
```

## Pytest Configuration

### pytest.ini or pyproject.toml settings (recommended):
```ini
[tool:pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
```

### Command-line Defaults:
Typically run with: `pytest tests/ -v --cov=src`

## Testing Async Code

### Async Fixture Pattern:
```python
@pytest.fixture
async def async_db_session():
    """Async database session fixture."""
    session = AsyncMock()
    yield session
    # Cleanup...
```

### Async Test Pattern:
```python
# Using pytest-asyncio
@pytest.mark.asyncio
async def test_find_relevant_articles():
    """Test async knowledge base search."""
    mock_pool = AsyncMock()
    searcher = KnowledgeBaseSearcher(db_pool=mock_pool)
    
    results = await searcher.find_relevant_articles("user issue")
    # Assertions...
```

### Mock Async Context Manager:
```python
mock_pool = AsyncMock()
mock_pool.acquire.return_value.__aenter__.return_value = AsyncMock()
mock_pool.acquire.return_value.__aexit__.return_value = None

# Use in tests:
async with mock_pool.acquire() as session:
    # Test code...
```

## Test Quality Guidelines

### What Gets Tested:
1. **Business Logic**: Core algorithm implementations (BM25 scoring, query expansion)
2. **State Management**: Conversation flow and state transitions
3. **Data Validation**: Input validation and error conditions
4. **Integration**: Repository methods with mocked database
5. **Error Handling**: Exception scenarios and graceful degradation

### What Typically Isn't Tested:
1. **External API calls**: Mocked to avoid network dependencies
2. **Database layer**: Tested via repository pattern with mocks
3. **Telegram handlers**: Integration tested with mock updates/context
4. **UI presentation**: Tested through format functions, not rendering

### Best Practices:
- **One assertion per test** (or logical group of related assertions)
- **Descriptive test names** that explain what and why
- **Isolated tests**: No test dependencies or shared state
- **Mock external dependencies**: Database, API clients, network I/O
- **Use fixtures for setup**: DRY principle for test data
- **Fast execution**: Unit tests should run in milliseconds
- **Comprehensive coverage**: Aim for >80% coverage on critical paths

## Coverage Expectations

### Current Coverage Areas:
1. **Knowledge Base Search**: BM25 scoring, query expansion, deduplication, term extraction
2. **Conversation Management**: State enums, state transitions, user state tracking
3. **Validation**: Question generation, response validation, issue classification
4. **Database Models**: ORM model definitions and representations

### Running Coverage Reports:
```bash
# Generate coverage report
pytest tests/ --cov=src --cov-report=html

# View coverage summary
pytest tests/ --cov=src --cov-report=term-missing
```

## Common Test Issues and Solutions

### Issue: Async Test Hangs
**Solution**: Use `pytest-asyncio` with `asyncio_mode=auto` in pytest.ini

### Issue: Mock Not Working
**Solution**: Mock at the point of use, not import
```python
# Wrong:
from src.utils.openai_client import OpenAIClient
OpenAIClient.mock = ...  # Won't work

# Right:
with patch('src.utils.openai_client.OpenAI') as mock_openai:
    # Test code...
```

### Issue: Import Errors in Tests
**Solution**: Use conftest.py fixtures or sys.path adjustment
```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
```

### Issue: Fixture Not Found
**Solution**: Ensure fixture is in conftest.py or test file, matches parameter name exactly
