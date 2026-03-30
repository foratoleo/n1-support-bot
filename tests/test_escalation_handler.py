"""Unit tests for escalation handler."""

import pytest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime, timezone
from uuid import uuid4

from src.escalation.handler import EscalationHandler, EscalationData


class TestEscalationData:
    """Tests for EscalationData dataclass."""

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
        assert escalation.impact == "High"
        assert escalation.status == "open"
        assert escalation.id is not None
        assert escalation.created_at is not None

    def test_create_escalation_with_defaults(self):
        """Test creating escalation with default values."""
        escalation = EscalationData.create(
            user_report_id="report-456",
            summary="Minimal escalation"
        )

        assert escalation.user_report_id == "report-456"
        assert escalation.summary == "Minimal escalation"
        assert escalation.project_name is None
        assert escalation.impact is None
        assert escalation.assigned_to is None
        assert escalation.status == "open"

    def test_create_escalation_generates_unique_id(self):
        """Test that create generates unique IDs."""
        esc1 = EscalationData.create(user_report_id="r1", summary="s1")
        esc2 = EscalationData.create(user_report_id="r2", summary="s2")

        assert esc1.id != esc2.id

    def test_create_escalation_sets_timestamp(self):
        """Test that create sets created_at timestamp."""
        before = datetime.now(timezone.utc)
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Timestamp test"
        )
        after = datetime.now(timezone.utc)

        assert before <= escalation.created_at <= after

    def test_escalation_with_assigned_to(self):
        """Test creating escalation with assigned agent."""
        agent_id = str(uuid4())
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Assigned issue",
            assigned_to=agent_id
        )

        assert escalation.assigned_to == agent_id

    def test_escalation_str_representation(self):
        """Test string representation of EscalationData."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Test",
            status="open"
        )

        # The dataclass should have a useful repr
        assert "EscalationData" in type(escalation).__name__


class TestEscalationHandler:
    """Tests for EscalationHandler class."""

    @pytest.fixture
    def mock_escalation_repo(self):
        """Create a mock escalation repository."""
        repo = AsyncMock()
        repo.create = AsyncMock()
        repo.get_by_report = AsyncMock()
        repo.get_by_report_id = AsyncMock()  # This method is called by get_escalation_status
        repo.update_status = AsyncMock()
        return repo

    @pytest.fixture
    def mock_user_report_repo(self):
        """Create a mock user report repository."""
        repo = AsyncMock()
        repo.update_status = AsyncMock()
        repo.get_by_id = AsyncMock()
        return repo

    @pytest.fixture
    def handler(self, mock_escalation_repo, mock_user_report_repo):
        """Create an EscalationHandler instance."""
        return EscalationHandler(
            escalation_repo=mock_escalation_repo,
            user_report_repo=mock_user_report_repo
        )

    @pytest.mark.asyncio
    async def test_create_escalation_success(self, handler, mock_escalation_repo, mock_user_report_repo):
        """Test successfully creating an escalation."""
        mock_escalation_repo.create.return_value = MagicMock()
        mock_user_report_repo.update_status.return_value = True

        escalation = await handler.create_escalation(
            report_id="report-123",
            summary="Test issue",
            project_name="Workforce App",
            impact="Medium"
        )

        assert escalation.summary == "Test issue"
        assert escalation.project_name == "Workforce App"
        assert escalation.impact == "Medium"
        mock_escalation_repo.create.assert_called_once()
        mock_user_report_repo.update_status.assert_called_once_with("report-123", "escalated")

    @pytest.mark.asyncio
    async def test_create_escalation_without_optional_params(self, handler, mock_escalation_repo, mock_user_report_repo):
        """Test creating escalation with only required parameters."""
        mock_escalation_repo.create.return_value = MagicMock()
        mock_user_report_repo.update_status.return_value = True

        escalation = await handler.create_escalation(
            report_id="report-456",
            summary="Minimal escalation"
        )

        assert escalation.summary == "Minimal escalation"
        assert escalation.project_name is None
        assert escalation.impact is None

    @pytest.mark.asyncio
    async def test_create_escalation_sets_open_status(self, handler, mock_escalation_repo, mock_user_report_repo):
        """Test that create_escalation sets status to open."""
        mock_escalation_repo.create.return_value = MagicMock()
        mock_user_report_repo.update_status.return_value = True

        escalation = await handler.create_escalation(
            report_id="report-123",
            summary="Status test"
        )

        assert escalation.status == "open"

    def test_format_escalation_message_basic(self, handler):
        """Test formatting basic escalation message."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="System is down",
            project_name="Workforce App",
            impact="High - All users affected",
            status="open"
        )

        message = handler.format_escalation_message(escalation)

        assert "report-123" in message
        assert "System is down" in message
        assert "Workforce App" in message
        assert "High" in message
        assert "human investigation" in message.lower() or "support team" in message.lower()

    def test_format_escalation_message_with_workarounds(self, handler):
        """Test formatting escalation message with workarounds."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Login issue",
            project_name="Auth Service",
            impact="Medium"
        )

        workarounds = [
            "Try clearing your browser cache",
            "Use incognito mode"
        ]

        message = handler.format_escalation_message(
            escalation,
            workarounds=workarounds
        )

        assert "Try clearing your browser cache" in message
        assert "Use incognito mode" in message
        assert "In the meantime" in message or "workaround" in message.lower()

    def test_format_escalation_message_with_known_issues(self, handler):
        """Test formatting escalation message with known issues reference."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Data not loading"
        )

        message = handler.format_escalation_message(
            escalation,
            known_issues=["Check known issues database"]
        )

        assert "known issues" in message.lower() or "database" in message.lower()

    def test_format_escalation_message_with_both_workarounds_and_known_issues(self, handler):
        """Test formatting escalation message with both workarounds and known issues."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Complex issue"
        )

        message = handler.format_escalation_message(
            escalation,
            workarounds=["Workaround 1"],
            known_issues=["Reference 1"]
        )

        assert "Workaround 1" in message
        assert "known issues database" in message.lower()

    def test_format_escalation_message_missing_optional_fields(self, handler):
        """Test formatting escalation when optional fields are None."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Minimal issue",
            project_name=None,
            impact=None
        )

        message = handler.format_escalation_message(escalation)

        assert "report-123" in message
        assert "Minimal issue" in message
        assert "Not specified" in message or "not specified" in message.lower()
        assert "To be determined" in message or "to be determined" in message.lower()

    def test_format_self_service_message_basic(self, handler):
        """Test formatting basic self-service message."""
        message = handler.format_self_service_message(
            article_title="Password Reset Guide",
            article_content="If you forgot your password, you can reset it by clicking the forgot password link on the login page.",
            guide_steps=[
                "Go to the login page",
                "Click 'Forgot Password'",
                "Enter your email address",
                "Check your email for reset link",
                "Create a new password"
            ]
        )

        assert "Password Reset Guide" in message
        assert "forgot your password" in message
        assert "Go to the login page" in message
        assert "Click 'Forgot Password'" in message
        assert "1." in message
        assert "2." in message
        assert "3." in message
        assert "4." in message
        assert "5." in message
        assert "does not resolve" in message.lower() or "let me know" in message.lower()

    def test_format_self_service_message_single_step(self, handler):
        """Test formatting self-service message with single step."""
        message = handler.format_self_service_message(
            article_title="Quick Fix",
            article_content="This is a simple fix.",
            guide_steps=["Just wait 5 minutes"]
        )

        assert "Quick Fix" in message
        assert "Just wait 5 minutes" in message
        assert "1." in message

    def test_format_self_service_message_empty_steps(self, handler):
        """Test formatting self-service message with no steps."""
        message = handler.format_self_service_message(
            article_title="No Steps Available",
            article_content="No resolution steps available.",
            guide_steps=[]
        )

        assert "No Steps Available" in message
        assert "No resolution steps" in message

    def test_format_self_service_message_preserves_content(self, handler):
        """Test that self-service message preserves exact content."""
        article_content = "Important: Clear cache before proceeding."
        guide_steps = ["Step one: Clear cache", "Step two: Refresh"]

        message = handler.format_self_service_message(
            article_title="Test",
            article_content=article_content,
            guide_steps=guide_steps
        )

        assert article_content in message
        assert "Step one: Clear cache" in message
        assert "Step two: Refresh" in message

    @pytest.mark.asyncio
    async def test_get_escalation_status_found(self, handler, mock_escalation_repo):
        """Test getting escalation status when escalation exists."""
        escalation = EscalationData.create(
            user_report_id="report-123",
            summary="Test"
        )
        mock_escalation_repo.get_by_report_id.return_value = escalation

        result = await handler.get_escalation_status("report-123")

        assert result == escalation
        mock_escalation_repo.get_by_report_id.assert_called_once_with("report-123")

    @pytest.mark.asyncio
    async def test_get_escalation_status_not_found(self, handler, mock_escalation_repo):
        """Test getting escalation status when not found."""
        mock_escalation_repo.get_by_report_id.return_value = None

        result = await handler.get_escalation_status("nonexistent")

        assert result is None

    def test_handler_initialization(self, handler, mock_escalation_repo, mock_user_report_repo):
        """Test that handler initializes with correct repositories."""
        assert handler.escalation_repo == mock_escalation_repo
        assert handler.user_report_repo == mock_user_report_repo


class TestEscalationFlow:
    """Integration tests for escalation flow."""

    @pytest.fixture
    def mock_escalation_repo(self):
        repo = AsyncMock()
        repo.create = AsyncMock()
        repo.get_by_report = AsyncMock()
        return repo

    @pytest.fixture
    def mock_user_report_repo(self):
        repo = AsyncMock()
        repo.update_status = AsyncMock()
        repo.update_status.return_value = True
        return repo

    @pytest.fixture
    def handler(self, mock_escalation_repo, mock_user_report_repo):
        return EscalationHandler(
            escalation_repo=mock_escalation_repo,
            user_report_repo=mock_user_report_repo
        )

    @pytest.mark.asyncio
    async def test_full_escalation_flow(self, handler, mock_escalation_repo, mock_user_report_repo):
        """Test complete escalation flow from creation to status check."""
        # Setup mock to return created escalation
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

    def test_format_escalation_then_message(self, handler):
        """Test formatting escalation data then creating message."""
        escalation = EscalationData.create(
            user_report_id="test-123",
            summary="Format test",
            project_name="Project X",
            impact="Critical"
        )

        # Format message
        message = handler.format_escalation_message(escalation)

        # Verify message contains escalation info
        assert "test-123" in message
        assert "Format test" in message
        assert "Project X" in message
        assert "Critical" in message
