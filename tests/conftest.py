import pytest
import asyncio
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
            "If a task is not showing in the sprint board, check if the task has been assigned to the sprint and that the sprint is active.",
            "planning")
