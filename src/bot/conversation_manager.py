"""Per-user conversation state management for N1 Support Bot."""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


class ConversationState(Enum):
    """Enumeration of possible conversation states."""

    IDLE = "idle"
    AWAITING_REPORT = "awaiting_report"
    AWAITING_VALIDATION_ANSWER = "awaiting_validation_answer"
    PROVIDING_GUIDANCE = "providing_guidance"
    ESCALATED = "escalated"


@dataclass
class UserConversationState:
    """Stores the conversation state for a specific user."""

    state: ConversationState
    user_id: int
    current_report_id: Optional[str] = None
    issue_description: Optional[str] = None
    classified_category: Optional[str] = None
    validation_questions: List[dict] = field(default_factory=list)
    current_question_index: int = 0
    validation_answers: List[str] = field(default_factory=list)
    kb_articles_found: List[tuple] = field(default_factory=list)
    escalation_id: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)


class ConversationManager:
    """Manages conversation states for all users."""

    def __init__(self):
        self._states: Dict[int, UserConversationState] = {}

    def get_user_state(self, user_id: int) -> UserConversationState:
        """Get current state for user, returns IDLE if no state exists.

        Args:
            user_id: The Telegram user ID.

        Returns:
            UserConversationState with IDLE state if no prior state exists.
        """
        if user_id not in self._states:
            self._states[user_id] = UserConversationState(
                state=ConversationState.IDLE,
                user_id=user_id,
            )
        return self._states[user_id]

    def update_user_state(self, user_id: int, state: ConversationState, **kwargs) -> UserConversationState:
        """Update user state and any additional context.

        Args:
            user_id: The Telegram user ID.
            state: The new conversation state.
            **kwargs: Additional fields to update in the user state.

        Returns:
            Updated UserConversationState.
        """
        current_state = self.get_user_state(user_id)
        current_state.state = state

        for key, value in kwargs.items():
            if hasattr(current_state, key):
                setattr(current_state, key, value)
            else:
                current_state.context[key] = value

        return current_state

    def clear_user_state(self, user_id: int) -> None:
        """Reset user state to IDLE.

        Args:
            user_id: The Telegram user ID.
        """
        if user_id in self._states:
            self._states[user_id].state = ConversationState.IDLE
            self._states[user_id].current_report_id = None
            self._states[user_id].issue_description = None
            self._states[user_id].classified_category = None
            self._states[user_id].validation_questions = []
            self._states[user_id].current_question_index = 0
            self._states[user_id].validation_answers = []
            self._states[user_id].kb_articles_found = []
            self._states[user_id].escalation_id = None
            self._states[user_id].context = {}