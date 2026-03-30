"""N1 Support Bot - Validation Module.

This module handles issue validation through:
- Question generation based on issue category
- Issue classification using keyword matching and GPT-4o
- Escalation decision logic
"""

from .questions import Question, QuestionGenerator
from .classifier import IssueClassification, EscalationDecision, IssueClassifier

__all__ = [
    "Question",
    "QuestionGenerator",
    "IssueClassification",
    "EscalationDecision",
    "IssueClassifier",
]
