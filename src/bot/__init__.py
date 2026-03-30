"""N1 Support Bot Telegram application."""

from .conversation_manager import (
    ConversationManager,
    ConversationState,
    UserConversationState,
)
from .templates import (
    BOT_MESSAGES,
    get_message,
    format_acknowledge,
    format_escalation,
    format_self_service,
    format_validation_question,
    format_status_report,
)
from .handlers import (
    conv_manager,
    register_handlers,
    start_command,
    help_command,
    cancel_command,
    report_command,
    status_command,
    handle_message,
)

__all__ = [
    # Conversation manager
    "ConversationManager",
    "ConversationState",
    "UserConversationState",
    # Templates
    "BOT_MESSAGES",
    "get_message",
    "format_acknowledge",
    "format_escalation",
    "format_self_service",
    "format_validation_question",
    "format_status_report",
    # Handlers
    "conv_manager",
    "register_handlers",
    "start_command",
    "help_command",
    "cancel_command",
    "report_command",
    "status_command",
    "handle_message",
]