# Testing Patterns

**Analysis Date:** 2026-03-31

## Test Framework

**Runner:**
- `pytest` >= 8.3.0 - Test runner and assertions
- `pytest-asyncio` >= 0.25.0 - Async test support
- `pytest-cov` >= 6.0.0 - Coverage reporting
- `pytest-mock` >= 3.14.0 - Mocking utilities

**Configuration File:** None (uses pytest defaults)

## Test File Organization

**Location:**
- Tests are co-located in `tests/` directory at project root
- Parallel to `src/` directory structure
- Test files match source module names: `test_<module_name>.py`

**Structure:**
```
tests/
├── __init__.py
├── conftest.py                 # Shared fixtures
├── test_conversation_manager.py
├── test_validation.py
├── test_escalation_handler.py
├── test_knowledge_base.py
├── test_templates.py
├── test_models.py
└── test_repositories.py
```

## Test Structure

### Organization Pattern

Tests are organized into classes by feature/component, following pytest class conventions:

```python
# From tests/test_conversation_manager.py
class TestConversationState:
    """Tests for ConversationState enum."""

    def test_all_states_exist(self):
        """Test that all expected states are defined."""
        states = [s.value for s in ConversationState]
        expected = ["idle", "awaiting_report", "awaiting_validation_answer", "providing_guidance", "escalated"]
        for state in expected:
            assert state in states

    def test_state_values(self):
        """Test ConversationState enum values."""
        assert ConversationState.IDLE.value == "idle"
        ...

class TestUserConversationState:
    """Tests for UserConversationState dataclass."""
    ...

class TestConversationManager:
    """Tests for ConversationManager."""
    ...
```

### Test Naming

- **Class names:** `Test<ComponentName>` (PascalCase)
- **Method names:** `test_<what_is_being_tested>` (snake_case)
- **Docstrings:** Brief description of what the test verifies

**Example:**
```python
def test_get_user_state_new_user(self, manager):
    """Test getting state for a new user returns IDLE."""
    state = manager.get_user_state(123)
    
    assert state.state == ConversationState.IDLE
    assert state.user_id == 123
```

## Fixtures

### Shared Fixtures (conftest.py)

```python
# From tests/conftest.py
import pytest
from unittest.mock import MagicMock, AsyncMock

@pytest.fixture
def mock_db_pool():
    pool = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = AsyncMock()
    pool.acquire.return_value.__aexit__.return_value = None
    return pool

@pytest.fixture
def mock_openai_client():
    client = MagicMock()
    client.chat.completion.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Test response"))]
    )
    return client

@pytest.fixture
def sample_issue_description():
    return "I cannot find my task in the sprint board"

@pytest.fixture
def sample_kb_article():
    return ("Task not visible in sprint",
            "If a task is not showing in the sprint board, check if the task has been assigned to the sprint...",
            "planning")
```

### Local Fixtures

```python
# From tests/test_conversation_manager.py
@pytest.fixture
def manager(self):
    """Create a fresh ConversationManager instance."""
    return ConversationManager()

# From tests/test_validation.py
@pytest.fixture
def generator(self):
    """Create a QuestionGenerator instance."""
    return QuestionGenerator()

@pytest.fixture
def mock_openai_client(self):
    """Create a mock OpenAI client."""
    return MagicMock()

@pytest.fixture
def mock_kb_searcher(self):
    """Create a mock KB searcher."""
    return MagicMock()
```

### Fixture Lifecycle

- **Function scope:** Default, created for each test
- **Class scope:** Use `@pytest.fixture(scope="class")` for expensive setup

## Mocking Patterns

### Async Mock Setup

**Database pool mock:**
```python
@pytest.fixture
def mock_db_pool():
    pool = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = AsyncMock()
    pool.acquire.return_value.__aexit__.return_value = None
    return pool
```

**Repository mocks:**
```python
# From tests/test_escalation_handler.py
@pytest.fixture
def mock_escalation_repo(self):
    repo = AsyncMock()
    repo.create = AsyncMock()
    repo.get_by_report = AsyncMock()
    repo.get_by_report_id = AsyncMock()
    repo.update_status = AsyncMock()
    return repo

@pytest.fixture
def mock_user_report_repo(self):
    repo = AsyncMock()
    repo.update_status = AsyncMock()
    repo.get_by_id = AsyncMock()
    return repo
```

### Mocking External Services

**OpenAI client mock:**
```python
# From tests/conftest.py
@pytest.fixture
def mock_openai_client():
    client = MagicMock()
    client.chat.completion.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Test response"))]
    )
    return client
```

**Usage in tests:**
```python
# From tests/test_validation.py
@pytest.mark.asyncio
async def test_should_escalate_user_requests_human(self, classifier):
    """Test escalation when user explicitly requests human help."""
    issue = "I need to speak to a human agent"
    answers = ["Yes I want to talk to someone"]
    articles = []

    result = await classifier.should_escalate(issue, answers, articles)

    assert result.should_escalate is True
    assert result.escalation_type == "user_requests_human"
```

### Mocking Knowledge Base Results

```python
# From tests/test_knowledge_base.py
class TestExtractSearchTerms:
    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_basic_term_extraction(self):
        """Extração de termos remove stopwords e mantém termos relevantes."""
        text = "The user cannot login to the system"
        terms = self.searcher._extract_search_terms(text)

        assert 'the' not in terms
        assert 'login' in terms
```

## Async Testing

### @pytest.mark.asyncio Decorator

```python
# From tests/test_validation.py
@pytest.mark.asyncio
async def test_should_escalate_user_requests_human(self, classifier):
    """Test escalation when user explicitly requests human help."""
    result = await classifier.should_escalate(issue, answers, articles)
    assert result.should_escalate is True

@pytest.mark.asyncio
async def test_create_escalation_success(self, handler, mock_escalation_repo, mock_user_report_repo):
    """Test successfully creating an escalation."""
    mock_escalation_repo.create.return_value = MagicMock()
    mock_user_report_repo.update_status.return_value = True

    escalation = await handler.create_escalation(
        report_id="report-123",
        summary="Test issue",
        ...
    )

    assert escalation.summary == "Test issue"
    mock_escalation_repo.create.assert_called_once()
```

## Assertion Patterns

### Standard Assertions

```python
assert state.state == ConversationState.IDLE
assert state.user_id == 123
assert result.should_escalate is True
assert result.escalation_type == "user_requests_human"
```

### Collection Assertions

```python
assert len(questions) <= 4
assert all(isinstance(q, Question) for q in questions)
assert len(deduped) == 2
assert ('Title A', 'Content A', 'area1', 10.0) in deduped
```

### Exception Assertions

```python
# From tests/test_templates.py
def test_get_message_missing_kwargs_raises_error(self):
    """Test that missing kwargs raises KeyError."""
    with pytest.raises(KeyError):
        get_message("acknowledge")
```

### Boolean Assertions

```python
assert result.should_escalate is True
assert result.should_escalate is False
assert 'the' not in terms
```

## Test Categories

### Unit Tests

**Dataclass tests:**
```python
# From tests/test_escalation_handler.py
def test_create_new_escalation(self):
    """Test creating a new escalation with factory method."""
    escalation = EscalationData.create(
        user_report_id="report-123",
        summary="Test escalation",
        project_name="Test Project",
        impact="High",
        status="open"
    )

    assert escalation.user_report_id == "report-123"
    assert escalation.summary == "Test escalation"
    assert escalation.project_name == "Test Project"
```

**Model tests:**
```python
# From tests/test_models.py
class TestKBDocument:
    def test_kb_document_creation(self):
        """Test creating a KBDocument with all fields."""
        doc = KBDocument(
            id=uuid4(),
            area="planning",
            title="Test Document",
            content="Test content",
            file_path="/kb/test.md"
        )
        assert doc.area == "planning"
        assert doc.title == "Test Document"
```

**State machine tests:**
```python
# From tests/test_conversation_manager.py
def test_state_transitions_awaiting_report_to_validating(self, manager):
    """Test transition from AWAITING_REPORT to AWAITING_VALIDATION_ANSWER."""
    manager.update_user_state(
        123,
        ConversationState.AWAITING_REPORT,
        issue_description="Test"
    )
    manager.update_user_state(
        123,
        ConversationState.AWAITING_VALIDATION_ANSWER,
        classified_category="data_missing"
    )
    state = manager.get_user_state(123)

    assert state.state == ConversationState.AWAITING_VALIDATION_ANSWER
    assert state.issue_description == "Test"
    assert state.classified_category == "data_missing"
```

### Integration Tests

**Repository flow tests:**
```python
# From tests/test_escalation_handler.py
class TestEscalationFlow:
    """Integration tests for escalation flow."""

    @pytest.mark.asyncio
    async def test_full_escalation_flow(self, handler, mock_escalation_repo, mock_user_report_repo):
        """Test complete escalation flow from creation to status check."""
        mock_escalation_repo.create.return_value = MagicMock()

        # Step 1: Create escalation
        escalation = await handler.create_escalation(
            report_id="report-flow-test",
            summary="Full flow test",
            project_name="Test Project",
            impact="Low"
        )

        # Step 2: Get status
        mock_escalation_repo.get_by_report_id.return_value = escalation
        status = await handler.get_escalation_status("report-flow-test")

        # Verify
        assert status is not None
        assert status.summary == "Full flow test"
        mock_user_report_repo.update_status.assert_called()
```

## Coverage

**Coverage Requirements:** None explicitly enforced

**Run Commands:**
```bash
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest tests/             # Run specific directory
pytest -k "test_name"     # Run tests matching pattern
pytest --cov=src          # With coverage
pytest --cov=src --cov-report=html  # HTML report
```

## Test Data Patterns

### Sample Data Fixtures

```python
# From tests/conftest.py
@pytest.fixture
def sample_issue_description():
    return "I cannot find my task in the sprint board"

@pytest.fixture
def sample_kb_article():
    return ("Task not visible in sprint",
            "If a task is not showing in the sprint board, check if the task has been assigned to the sprint and that the sprint is active.",
            "planning")
```

### Builder Pattern for Complex Data

```python
# From tests/test_knowledge_base.py
def _make_row(self, title, content):
    """Cria um objeto row simulado."""
    row = MagicMock()
    row.__getitem__ = lambda self, key: {
        'title': title,
        'content': content,
        'area': 'geral',
        'doc_length': len(content),
    }[key]
    row.get = lambda key, default=None: {'area': 'geral'}.get(key, default)
    return row
```

## What to Mock

**Mock:**
- Database connections (`mock_db_pool`)
- External API clients (`mock_openai_client`)
- Repository classes (for unit tests)
- Time-dependent functions (use `datetime` fixtures)

**What NOT to Mock:**
- SQLAlchemy models (test actual behavior)
- Dataclasses (simple, test directly)
- Pure utility functions

## Run Commands

```bash
# All tests
pytest

# Verbose output
pytest -v

# Specific test file
pytest tests/test_conversation_manager.py

# Specific test class
pytest tests/test_conversation_manager.py::TestConversationManager

# Specific test
pytest tests/test_conversation_manager.py::TestConversationManager::test_get_user_state_new_user

# With coverage
pytest --cov=src --cov-report=term-missing

# Async tests only
pytest tests/test_validation.py -v
```

---

*Testing analysis: 2026-03-31*
