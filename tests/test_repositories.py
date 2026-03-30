"""Unit tests for database repositories."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.database.repositories import (
    KBDocumentRepository,
    UserReportRepository,
    ConversationRepository,
    EscalationRepository,
)
from src.database.models import KBDocument, UserReport, Conversation, Escalation


class MockAsyncIterator:
    """Helper to create async iterators from lists."""
    def __init__(self, items):
        self.items = items
        self.index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self.index]
        self.index += 1
        return item


class TestKBDocumentRepository:
    """Tests for KBDocumentRepository."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock AsyncSession."""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_doc(self):
        """Create a sample KBDocument."""
        return KBDocument(
            id=uuid4(),
            area="planning",
            title="Test Document",
            content="Test content about sprint planning"
        )

    @pytest.mark.asyncio
    async def test_search_finds_documents_by_keyword(self, mock_session, sample_doc):
        """Test that search finds documents containing the query keyword."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_doc]
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        results = await repo.search("sprint")

        assert len(results) == 1
        assert results[0].title == "Test Document"
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_with_area_filter(self, mock_session):
        """Test that search can filter by area."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        await repo.search("test", area="frontend")

        call_args = mock_session.execute.call_args
        assert call_args is not None

    @pytest.mark.asyncio
    async def test_search_with_limit(self, mock_session):
        """Test that search respects the limit parameter."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        await repo.search("test", limit=3)

        call_args = mock_session.execute.call_args
        assert call_args is not None

    @pytest.mark.asyncio
    async def test_search_returns_empty_list_when_no_results(self, mock_session):
        """Test that search returns empty list when no documents match."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        results = await repo.search("nonexistent")

        assert results == []

    @pytest.mark.asyncio
    async def test_get_by_id_found(self, mock_session, sample_doc):
        """Test getting a document by ID when it exists."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_doc
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        result = await repo.get_by_id(sample_doc.id)

        assert result == sample_doc

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_session):
        """Test getting a document by ID when it does not exist."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        result = await repo.get_by_id(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_area(self, mock_session):
        """Test getting all documents in an area."""
        docs = [
            KBDocument(id=uuid4(), area="planning", title="Doc 1", content="Content 1"),
            KBDocument(id=uuid4(), area="planning", title="Doc 2", content="Content 2"),
        ]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = docs
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        results = await repo.get_by_area("planning")

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_count_returns_total_documents(self, mock_session):
        """Test that count returns the total number of documents."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 42
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        count = await repo.count()

        assert count == 42

    @pytest.mark.asyncio
    async def test_count_returns_zero_when_empty(self, mock_session):
        """Test that count returns 0 when no documents exist."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        mock_session.execute.return_value = mock_result

        repo = KBDocumentRepository(mock_session)
        count = await repo.count()

        assert count == 0


class TestUserReportRepository:
    """Tests for UserReportRepository."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock AsyncSession."""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_report(self):
        """Create a sample UserReport."""
        return UserReport(
            id=uuid4(),
            user_id=uuid4(),
            project_id=uuid4(),
            description="Test issue",
            status="pending"
        )

    @pytest.mark.asyncio
    async def test_create_report(self, mock_session):
        """Test creating a new user report."""
        repo = UserReportRepository(mock_session)

        with patch.object(repo.session, 'refresh', new_callable=AsyncMock):
            report = await repo.create(
                description="Test issue",
                user_id=uuid4(),
                project_id=uuid4()
            )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_report_without_optional_ids(self, mock_session):
        """Test creating a report with only required fields."""
        repo = UserReportRepository(mock_session)

        with patch.object(repo.session, 'refresh', new_callable=AsyncMock):
            report = await repo.create(description="Minimal report")

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_status_success(self, mock_session, sample_report):
        """Test successfully updating report status."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_report
        mock_session.execute.return_value = mock_result

        repo = UserReportRepository(mock_session)
        success = await repo.update_status(sample_report.id, "resolved")

        assert success is True
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, mock_session):
        """Test updating status of non-existent report."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        repo = UserReportRepository(mock_session)
        success = await repo.update_status(uuid4(), "resolved")

        assert success is False
        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_by_id_found(self, mock_session, sample_report):
        """Test getting a report by ID when it exists."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_report
        mock_session.execute.return_value = mock_result

        repo = UserReportRepository(mock_session)
        result = await repo.get_by_id(sample_report.id)

        assert result == sample_report

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_session):
        """Test getting a report by ID when it does not exist."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        repo = UserReportRepository(mock_session)
        result = await repo.get_by_id(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_user(self, mock_session):
        """Test getting all reports for a specific user."""
        user_id = uuid4()
        reports = [
            UserReport(id=uuid4(), user_id=user_id, description="Report 1"),
            UserReport(id=uuid4(), user_id=user_id, description="Report 2"),
        ]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = reports
        mock_session.execute.return_value = mock_result

        repo = UserReportRepository(mock_session)
        results = await repo.get_by_user(user_id)

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_get_by_user_returns_empty_list(self, mock_session):
        """Test getting reports for user with no reports."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        repo = UserReportRepository(mock_session)
        results = await repo.get_by_user(uuid4())

        assert results == []


class TestConversationRepository:
    """Tests for ConversationRepository."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock AsyncSession."""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_conversation(self):
        """Create a sample Conversation."""
        return Conversation(
            id=uuid4(),
            user_report_id=uuid4(),
            role="user",
            message="Test message"
        )

    @pytest.mark.asyncio
    async def test_add_message(self, mock_session):
        """Test adding a message to a conversation."""
        repo = ConversationRepository(mock_session)
        report_id = uuid4()

        with patch.object(repo.session, 'refresh', new_callable=AsyncMock):
            conversation = await repo.add_message(
                report_id=report_id,
                role="user",
                message="Hello"
            )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_bot_message(self, mock_session):
        """Test adding a bot message to a conversation."""
        repo = ConversationRepository(mock_session)
        report_id = uuid4()

        with patch.object(repo.session, 'refresh', new_callable=AsyncMock):
            conversation = await repo.add_message(
                report_id=report_id,
                role="bot",
                message="How can I help?"
            )

        mock_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_report(self, mock_session):
        """Test getting all messages for a report."""
        report_id = uuid4()
        messages = [
            Conversation(id=uuid4(), user_report_id=report_id, role="user", message="Hi"),
            Conversation(id=uuid4(), user_report_id=report_id, role="bot", message="Hello"),
        ]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = messages
        mock_session.execute.return_value = mock_result

        repo = ConversationRepository(mock_session)
        results = await repo.get_by_report(report_id)

        assert len(results) == 2
        assert results[0].role == "user"
        assert results[1].role == "bot"

    @pytest.mark.asyncio
    async def test_get_by_report_returns_empty_list(self, mock_session):
        """Test getting messages for report with no conversation."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        repo = ConversationRepository(mock_session)
        results = await repo.get_by_report(uuid4())

        assert results == []


class TestEscalationRepository:
    """Tests for EscalationRepository."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock AsyncSession."""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_escalation(self):
        """Create a sample Escalation."""
        return Escalation(
            id=uuid4(),
            user_report_id=uuid4(),
            summary="Test escalation",
            project_name="Test Project",
            impact="Medium",
            status="open"
        )

    @pytest.mark.asyncio
    async def test_create_escalation(self, mock_session):
        """Test creating a new escalation."""
        repo = EscalationRepository(mock_session)
        report_id = uuid4()

        with patch.object(repo.session, 'refresh', new_callable=AsyncMock):
            escalation = await repo.create(
                report_id=report_id,
                summary="Critical issue",
                project_name="Workforce",
                impact="High"
            )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_escalation_without_optional_fields(self, mock_session):
        """Test creating an escalation with only required fields."""
        repo = EscalationRepository(mock_session)
        report_id = uuid4()

        with patch.object(repo.session, 'refresh', new_callable=AsyncMock):
            escalation = await repo.create(
                report_id=report_id,
                summary="Minimal escalation"
            )

        mock_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_report(self, mock_session, sample_escalation):
        """Test getting an escalation by report ID."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_escalation
        mock_session.execute.return_value = mock_result

        repo = EscalationRepository(mock_session)
        result = await repo.get_by_report(sample_escalation.user_report_id)

        assert result == sample_escalation

    @pytest.mark.asyncio
    async def test_get_by_report_not_found(self, mock_session):
        """Test getting escalation for non-existent report."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        repo = EscalationRepository(mock_session)
        result = await repo.get_by_report(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_update_status_success(self, mock_session, sample_escalation):
        """Test successfully updating escalation status."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_escalation
        mock_session.execute.return_value = mock_result

        repo = EscalationRepository(mock_session)
        success = await repo.update_status(sample_escalation.id, "resolved")

        assert success is True
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, mock_session):
        """Test updating status of non-existent escalation."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        repo = EscalationRepository(mock_session)
        success = await repo.update_status(uuid4(), "resolved")

        assert success is False
        mock_session.commit.assert_not_called()
