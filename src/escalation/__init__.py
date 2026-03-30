"""
Escalation module for N1 Support Bot.

Provides escalation creation, management, and message formatting
for issues that require human agent intervention.
"""

from src.escalation.handler import (
    EscalationData,
    EscalationHandler,
)

__all__ = [
    "EscalationData",
    "EscalationHandler",
]
