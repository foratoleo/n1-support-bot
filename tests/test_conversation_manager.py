"""Unit tests for conversation manager."""

import pytest

from src.bot.conversation_manager import (
    ConversationManager,
    ConversationState,
    UserConversationState,
)


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
        assert ConversationState.AWAITING_REPORT.value == "awaiting_report"
        assert ConversationState.AWAITING_VALIDATION_ANSWER.value == "awaiting_validation_answer"
        assert ConversationState.PROVIDING_GUIDANCE.value == "providing_guidance"
        assert ConversationState.ESCALATED.value == "escalated"


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
        assert state.issue_description is None
        assert state.classified_category is None
        assert state.validation_questions == []
        assert state.current_question_index == 0
        assert state.validation_answers == []
        assert state.kb_articles_found == []
        assert state.escalation_id is None
        assert state.context == {}

    def test_full_initialization(self):
        """Test UserConversationState with all fields."""
        state = UserConversationState(
            state=ConversationState.ESCALATED,
            user_id=456,
            current_report_id="report-123",
            issue_description="Test issue",
            classified_category="data_missing",
            validation_questions=[{"id": "1", "text": "Question?"}],
            current_question_index=2,
            validation_answers=["Answer 1", "Answer 2"],
            kb_articles_found=[("Title", "Content")],
            escalation_id="esc-123",
            context={"key": "value"}
        )

        assert state.state == ConversationState.ESCALATED
        assert state.user_id == 456
        assert state.current_report_id == "report-123"
        assert state.issue_description == "Test issue"
        assert state.classified_category == "data_missing"
        assert len(state.validation_questions) == 1
        assert state.current_question_index == 2
        assert len(state.validation_answers) == 2
        assert len(state.kb_articles_found) == 1
        assert state.escalation_id == "esc-123"
        assert state.context == {"key": "value"}


class TestConversationManager:
    """Tests for ConversationManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh ConversationManager instance."""
        return ConversationManager()

    def test_get_user_state_new_user(self, manager):
        """Test getting state for a new user returns IDLE."""
        state = manager.get_user_state(123)

        assert state.state == ConversationState.IDLE
        assert state.user_id == 123

    def test_get_user_state_same_user_returns_same_state(self, manager):
        """Test that getting state for same user returns same state object."""
        state1 = manager.get_user_state(123)
        state2 = manager.get_user_state(123)

        assert state1 is state2

    def test_get_user_state_different_users_different_states(self, manager):
        """Test that different users have different state objects."""
        state1 = manager.get_user_state(123)
        state2 = manager.get_user_state(456)

        assert state1 is not state2
        assert state1.user_id == 123
        assert state2.user_id == 456

    def test_update_user_state_changes_state(self, manager):
        """Test updating user state changes the state value."""
        manager.update_user_state(123, ConversationState.AWAITING_REPORT)
        state = manager.get_user_state(123)

        assert state.state == ConversationState.AWAITING_REPORT

    def test_update_user_state_with_issue_description(self, manager):
        """Test updating user state with issue description."""
        manager.update_user_state(
            123,
            ConversationState.AWAITING_REPORT,
            issue_description="My task is missing"
        )
        state = manager.get_user_state(123)

        assert state.state == ConversationState.AWAITING_REPORT
        assert state.issue_description == "My task is missing"

    def test_update_user_state_with_report_id(self, manager):
        """Test updating user state with report ID."""
        manager.update_user_state(
            123,
            ConversationState.PROVIDING_GUIDANCE,
            current_report_id="report-456"
        )
        state = manager.get_user_state(123)

        assert state.current_report_id == "report-456"

    def test_update_user_state_with_classified_category(self, manager):
        """Test updating user state with classified category."""
        manager.update_user_state(
            123,
            ConversationState.AWAITING_VALIDATION_ANSWER,
            classified_category="data_missing"
        )
        state = manager.get_user_state(123)

        assert state.classified_category == "data_missing"

    def test_update_user_state_with_validation_data(self, manager):
        """Test updating user state with validation questions and index."""
        questions = [{"id": "1", "text": "Question 1?"}]
        manager.update_user_state(
            123,
            ConversationState.AWAITING_VALIDATION_ANSWER,
            validation_questions=questions,
            current_question_index=1
        )
        state = manager.get_user_state(123)

        assert state.validation_questions == questions
        assert state.current_question_index == 1

    def test_update_user_state_with_answers(self, manager):
        """Test updating user state with validation answers."""
        manager.update_user_state(
            123,
            ConversationState.AWAITING_VALIDATION_ANSWER,
            validation_answers=["Answer 1", "Answer 2"]
        )
        state = manager.get_user_state(123)

        assert state.validation_answers == ["Answer 1", "Answer 2"]

    def test_update_user_state_with_kb_articles(self, manager):
        """Test updating user state with KB articles found."""
        articles = [("Title 1", "Content 1"), ("Title 2", "Content 2")]
        manager.update_user_state(
            123,
            ConversationState.PROVIDING_GUIDANCE,
            kb_articles_found=articles
        )
        state = manager.get_user_state(123)

        assert state.kb_articles_found == articles

    def test_update_user_state_with_escalation_id(self, manager):
        """Test updating user state with escalation ID."""
        manager.update_user_state(
            123,
            ConversationState.ESCALATED,
            escalation_id="esc-789"
        )
        state = manager.get_user_state(123)

        assert state.escalation_id == "esc-789"

    def test_update_user_state_with_context(self, manager):
        """Test updating user state with custom context."""
        manager.update_user_state(
            123,
            ConversationState.AWAITING_REPORT,
            custom_field="custom_value"
        )
        state = manager.get_user_state(123)

        # Custom fields should go to context
        assert state.context.get("custom_field") == "custom_value"

    def test_clear_user_state_resets_to_idle(self, manager):
        """Test that clearing user state resets to IDLE."""
        manager.update_user_state(123, ConversationState.AWAITING_REPORT)
        manager.clear_user_state(123)
        state = manager.get_user_state(123)

        assert state.state == ConversationState.IDLE

    def test_clear_user_state_clears_all_fields(self, manager):
        """Test that clearing user state clears all stored fields."""
        manager.update_user_state(
            123,
            ConversationState.PROVIDING_GUIDANCE,
            issue_description="Test issue",
            current_report_id="report-123",
            classified_category="data_missing",
            validation_questions=[{"id": "1", "text": "Question?"}],
            current_question_index=2,
            validation_answers=["Answer 1"],
            kb_articles_found=[("Title", "Content")],
            escalation_id="esc-123"
        )

        manager.clear_user_state(123)
        state = manager.get_user_state(123)

        assert state.current_report_id is None
        assert state.issue_description is None
        assert state.classified_category is None
        assert state.validation_questions == []
        assert state.current_question_index == 0
        assert state.validation_answers == []
        assert state.kb_articles_found == []
        assert state.escalation_id is None
        assert state.context == {}

    def test_clear_user_state_clears_context(self, manager):
        """Test that clearing user state also clears context."""
        manager.update_user_state(
            123,
            ConversationState.AWAITING_REPORT,
            some_context="value"
        )
        manager.clear_user_state(123)
        state = manager.get_user_state(123)

        assert state.context == {}

    def test_clear_nonexistent_user_does_not_error(self, manager):
        """Test that clearing a nonexistent user does not raise an error."""
        # Getting a new user creates them in IDLE state
        manager.clear_user_state(999)
        state = manager.get_user_state(999)

        assert state.state == ConversationState.IDLE

    def test_state_transitions_idle_to_awaiting_report(self, manager):
        """Test transition from IDLE to AWAITING_REPORT."""
        state = manager.get_user_state(123)
        assert state.state == ConversationState.IDLE

        manager.update_user_state(123, ConversationState.AWAITING_REPORT)
        state = manager.get_user_state(123)

        assert state.state == ConversationState.AWAITING_REPORT

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

    def test_state_transitions_to_providing_guidance(self, manager):
        """Test transition to PROVIDING_GUIDANCE state."""
        manager.update_user_state(
            123,
            ConversationState.PROVIDING_GUIDANCE,
            kb_articles_found=[("Title", "Content")]
        )
        state = manager.get_user_state(123)

        assert state.state == ConversationState.PROVIDING_GUIDANCE

    def test_state_transitions_to_escalated(self, manager):
        """Test transition to ESCALATED state."""
        manager.update_user_state(
            123,
            ConversationState.ESCALATED,
            escalation_id="esc-123"
        )
        state = manager.get_user_state(123)

        assert state.state == ConversationState.ESCALATED
        assert state.escalation_id == "esc-123"

    def test_multiple_users_independent_states(self, manager):
        """Test that multiple users maintain independent states."""
        manager.update_user_state(123, ConversationState.AWAITING_REPORT)
        manager.update_user_state(456, ConversationState.ESCALATED)
        manager.update_user_state(789, ConversationState.PROVIDING_GUIDANCE)

        assert manager.get_user_state(123).state == ConversationState.AWAITING_REPORT
        assert manager.get_user_state(456).state == ConversationState.ESCALATED
        assert manager.get_user_state(789).state == ConversationState.PROVIDING_GUIDANCE

    def test_replacing_state_preserves_user_id(self, manager):
        """Test that replacing state preserves the user_id."""
        state1 = manager.get_user_state(123)
        original_user_id = state1.user_id

        manager.update_user_state(123, ConversationState.ESCALATED)
        state2 = manager.get_user_state(123)

        assert state2.user_id == original_user_id
        assert state2.user_id == 123
