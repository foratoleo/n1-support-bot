"""Database module for N1 Support Bot Telegram application.

This module provides PostgreSQL database connectivity and data access
for the RAG-based support bot system.
"""

from .connection import DatabasePool, get_database_pool
from .models import Base, KBDocument, UserReport, Conversation, Escalation
from .repositories import (
    KBDocumentRepository,
    UserReportRepository,
    ConversationRepository,
    EscalationRepository,
)

__all__ = [
    "DatabasePool",
    "get_database_pool",
    "Base",
    "KBDocument",
    "UserReport",
    "Conversation",
    "Escalation",
    "KBDocumentRepository",
    "UserReportRepository",
    "ConversationRepository",
    "EscalationRepository",
]
