"""Unit tests for bot templates."""

import pytest

from src.bot.templates import (
    BOT_MESSAGES,
    get_message,
    format_acknowledge,
    format_escalation,
    format_self_service,
    format_validation_question,
    format_status_report,
)


class TestBotMessages:
    """Tests for BOT_MESSAGES dictionary."""

    def test_welcome_message_exists(self):
        """Test that welcome message exists."""
        assert "welcome" in BOT_MESSAGES
        assert len(BOT_MESSAGES["welcome"]) > 0

    def test_help_message_exists(self):
        """Test that help message exists."""
        assert "help" in BOT_MESSAGES
        assert "/start" in BOT_MESSAGES["help"]
        assert "/help" in BOT_MESSAGES["help"]
        assert "/report" in BOT_MESSAGES["help"]

    def test_acknowledge_message_exists(self):
        """Test that acknowledge message exists."""
        assert "acknowledge" in BOT_MESSAGES
        assert "{report_id}" in BOT_MESSAGES["acknowledge"]

    def test_ask_question_message_exists(self):
        """Test that ask_question message exists."""
        assert "ask_question" in BOT_MESSAGES
        assert "{current}" in BOT_MESSAGES["ask_question"]
        assert "{total}" in BOT_MESSAGES["ask_question"]
        assert "{question}" in BOT_MESSAGES["ask_question"]

    def test_known_issue_message_exists(self):
        """Test that known_issue message exists."""
        assert "known_issue" in BOT_MESSAGES
        assert "{summary}" in BOT_MESSAGES["known_issue"]
        assert "{steps}" in BOT_MESSAGES["known_issue"]

    def test_escalate_message_exists(self):
        """Test that escalate message exists."""
        assert "escalate" in BOT_MESSAGES
        assert "{report_id}" in BOT_MESSAGES["escalate"]
        assert "{issue}" in BOT_MESSAGES["escalate"]
        assert "{project}" in BOT_MESSAGES["escalate"]
        assert "{impact}" in BOT_MESSAGES["escalate"]

    def test_status_format_message_exists(self):
        """Test that status_format message exists."""
        assert "status_format" in BOT_MESSAGES
        assert "{report_id}" in BOT_MESSAGES["status_format"]
        assert "{status}" in BOT_MESSAGES["status_format"]

    def test_cancel_message_exists(self):
        """Test that cancel message exists."""
        assert "cancel" in BOT_MESSAGES
        assert len(BOT_MESSAGES["cancel"]) > 0

    def test_error_message_exists(self):
        """Test that error message exists."""
        assert "error" in BOT_MESSAGES
        assert len(BOT_MESSAGES["error"]) > 0


class TestGetMessage:
    """Tests for get_message function."""

    def test_get_existing_message(self):
        """Test getting an existing message."""
        msg = get_message("welcome")
        assert msg is not None
        assert len(msg) > 0

    def test_get_nonexistent_message_returns_empty(self):
        """Test that getting nonexistent message returns empty string."""
        msg = get_message("nonexistent_key")
        assert msg == ""

    def test_get_message_with_kwargs(self):
        """Test getting message with format arguments."""
        msg = get_message("acknowledge", report_id="123-456")
        assert "123-456" in msg

    def test_get_message_missing_kwargs_raises_error(self):
        """Test that missing kwargs raises KeyError."""
        with pytest.raises(KeyError):
            get_message("acknowledge")


class TestFormatAcknowledge:
    """Tests for format_acknowledge function."""

    def test_format_acknowledge_with_report_id(self):
        """Test formatting acknowledgment with report ID."""
        msg = format_acknowledge("123-456")
        assert "123-456" in msg
        assert "report id" in msg.lower()

    def test_format_acknowledge_different_ids(self):
        """Test formatting acknowledgment with different report IDs."""
        msg1 = format_acknowledge("abc-123")
        msg2 = format_acknowledge("xyz-789")

        assert "abc-123" in msg1
        assert "xyz-789" in msg2

    def test_format_acknowledge_returns_string(self):
        """Test that format_acknowledge returns a string."""
        msg = format_acknowledge("test-id")
        assert isinstance(msg, str)


class TestFormatEscalation:
    """Tests for format_escalation function."""

    def test_format_escalation_with_all_params(self):
        """Test formatting escalation with all parameters."""
        msg = format_escalation(
            report_id="123-456",
            issue="Test issue",
            project="Test Project",
            impact="High"
        )
        assert "123-456" in msg
        assert "Test issue" in msg
        assert "Test Project" in msg
        assert "High" in msg

    def test_format_escalation_with_defaults(self):
        """Test formatting escalation with default values."""
        msg = format_escalation(
            report_id="123-456",
            issue="Test issue"
        )
        assert "123-456" in msg
        assert "Test issue" in msg
        assert "Not specified" in msg or "not specified" in msg.lower()
        assert "To be determined" in msg or "to be determined" in msg.lower()

    def test_format_escalation_empty_strings(self):
        """Test formatting escalation with empty optional strings."""
        msg = format_escalation(
            report_id="123-456",
            issue="Test issue",
            project="",
            impact=""
        )
        assert "123-456" in msg


class TestFormatSelfService:
    """Tests for format_self_service function."""

    def test_format_self_service_with_steps(self):
        """Test formatting self-service message with steps."""
        steps = ["Clear browser cache", "Refresh the page", "Try again"]
        msg = format_self_service(
            summary="Known issue: Data not loading",
            steps=steps
        )
        assert "Known issue" in msg or "known issue" in msg.lower()
        assert "Data not loading" in msg
        assert "Clear browser cache" in msg
        assert "Refresh the page" in msg
        assert "Try again" in msg

    def test_format_self_service_single_step(self):
        """Test formatting self-service message with single step."""
        msg = format_self_service(
            summary="Quick fix",
            steps=["Just wait 5 minutes"]
        )
        assert "Just wait 5 minutes" in msg

    def test_format_self_service_empty_steps(self):
        """Test formatting self-service message with empty steps."""
        msg = format_self_service(
            summary="No steps available",
            steps=[]
        )
        assert "No steps available" in msg

    def test_format_self_service_step_numbering(self):
        """Test that steps are properly numbered."""
        steps = ["First step", "Second step", "Third step"]
        msg = format_self_service(summary="Test", steps=steps)

        assert "1." in msg
        assert "2." in msg
        assert "3." in msg


class TestFormatValidationQuestion:
    """Tests for format_validation_question function."""

    def test_format_validation_question_basic(self):
        """Test formatting basic validation question."""
        msg = format_validation_question(1, 3, "What happened?")
        assert "What happened?" in msg
        assert "1" in msg
        assert "3" in msg

    def test_format_validation_question_first_question(self):
        """Test formatting first question in series."""
        msg = format_validation_question(1, 5, "Question text")
        assert "1" in msg
        assert "5" in msg

    def test_format_validation_question_last_question(self):
        """Test formatting last question in series."""
        msg = format_validation_question(5, 5, "Final question")
        assert "5" in msg
        assert "Final question" in msg

    def test_format_validation_question_middle_question(self):
        """Test formatting middle question in series."""
        msg = format_validation_question(2, 10, "Middle question")
        assert "2" in msg
        assert "10" in msg
        assert "Middle question" in msg

    def test_format_validation_question_preserves_text(self):
        """Test that question text is preserved exactly."""
        question_text = "Can you describe the exact error message you received?"
        msg = format_validation_question(1, 1, question_text)
        assert question_text in msg


class TestFormatStatusReport:
    """Tests for format_status_report function."""

    def test_format_status_report_basic(self):
        """Test formatting basic status report."""
        msg = format_status_report(
            report_id="123-456",
            status="pending",
            created_at="2024-01-01 10:00:00",
            escalated=False
        )
        assert "123-456" in msg
        assert "pending" in msg

    def test_format_status_report_escalated(self):
        """Test formatting status report with escalation."""
        msg = format_status_report(
            report_id="123-456",
            status="escalated",
            created_at="2024-01-01 10:00:00",
            escalated=True
        )
        assert "escalated" in msg
        assert "Yes" in msg

    def test_format_status_report_not_escalated(self):
        """Test formatting status report without escalation."""
        msg = format_status_report(
            report_id="123-456",
            status="resolved",
            created_at="2024-01-01 10:00:00",
            escalated=False
        )
        assert "No" in msg

    def test_format_status_report_all_statuses(self):
        """Test formatting status report with different statuses."""
        statuses = ["pending", "processing", "resolved", "escalated", "closed"]
        for status in statuses:
            msg = format_status_report(
                report_id="test",
                status=status,
                created_at="now",
                escalated=False
            )
            assert status in msg


class TestMessageTemplates:
    """Integration tests for complete message flows."""

    def test_acknowledge_message_includes_report_id_format(self):
        """Test that acknowledge template has proper format."""
        template = BOT_MESSAGES["acknowledge"]
        assert "{report_id}" in template

    def test_escalation_message_has_all_placeholders(self):
        """Test that escalation template has all required placeholders."""
        template = BOT_MESSAGES["escalate"]
        placeholders = ["{report_id}", "{issue}", "{project}", "{impact}"]
        for placeholder in placeholders:
            assert placeholder in template

    def test_all_messages_are_strings(self):
        """Test that all BOT_MESSAGES values are strings."""
        for key, value in BOT_MESSAGES.items():
            assert isinstance(value, str), f"Message '{key}' is not a string"

    def test_all_messages_are_non_empty(self):
        """Test that all BOT_MESSAGES values are non-empty."""
        for key, value in BOT_MESSAGES.items():
            assert len(value) > 0, f"Message '{key}' is empty"
