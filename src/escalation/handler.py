"""
Escalation handler for N1 Support Bot.

Manages escalation creation, status tracking, and message formatting
according to the bot behavior specifications.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from src.bot import strings


@dataclass
class EscalationData:
    """Data class representing an escalation record."""

    id: str
    user_report_id: str
    summary: str
    project_name: Optional[str]
    impact: Optional[str]
    assigned_to: Optional[str]
    status: str
    created_at: datetime

    @classmethod
    def create(
        cls,
        user_report_id: str,
        summary: str,
        project_name: Optional[str] = None,
        impact: Optional[str] = None,
        assigned_to: Optional[str] = None,
        status: str = "open",
    ) -> "EscalationData":
        """Factory method to create a new escalation with generated ID and timestamp."""
        return cls(
            id=str(uuid4()),
            user_report_id=user_report_id,
            summary=summary,
            project_name=project_name,
            impact=impact,
            assigned_to=assigned_to,
            status=status,
            created_at=datetime.now(timezone.utc),
        )


class EscalationHandler:
    """
    Handler for escalation operations.

    Uses repository pattern to interact with escalations and user reports.
    """

    def __init__(self, escalation_repo, user_report_repo):
        """
        Initialize the escalation handler.

        Args:
            escalation_repo: Repository for escalation data operations.
            user_report_repo: Repository for user report data operations.
        """
        self.escalation_repo = escalation_repo
        self.user_report_repo = user_report_repo

    async def create_escalation(
        self,
        report_id: str,
        summary: str,
        project_name: Optional[str] = None,
        impact: Optional[str] = None,
        assigned_to: Optional[str] = None,
    ) -> EscalationData:
        """
        Create an escalation record and update the associated user report status.

        Args:
            report_id: The ID of the user report to escalate.
            summary: Brief description of the issue.
            project_name: Optional name of the project related to the issue.
            impact: Optional description of how the issue affects the user.
            assigned_to: Optional agent ID to assign the escalation to.

        Returns:
            The created EscalationData instance.

        Raises:
            ValueError: If the report_id is not found in user_report_repo.
        """
        escalation = EscalationData.create(
            user_report_id=report_id,
            summary=summary,
            project_name=project_name,
            impact=impact,
            assigned_to=assigned_to,
            status="open",
        )

        await self.escalation_repo.create(
            report_id=escalation.user_report_id,
            summary=escalation.summary,
            project_name=escalation.project_name,
            impact=escalation.impact,
            assigned_to=escalation.assigned_to,
        )

        await self.user_report_repo.update_status(report_id, "escalated")

        return escalation

    def format_escalation_message(
        self,
        escalation: EscalationData,
        workarounds: Optional[List[str]] = None,
        known_issues: Optional[List[str]] = None,
    ) -> str:
        """
        Format an escalation notification message.

        Uses the escalation template from bot.md specification:
        - Lines 70-83: Escalation Template

        Args:
            escalation: The escalation data to format.
            workarounds: Optional list of temporary workarounds to provide.
            known_issues: Optional list of known issue references.

        Returns:
            Formatted escalation message string.
        """
        lines = [
            strings.ESCALATION_MESSAGE.format(
                issue=escalation.summary,
                project=escalation.project_name or strings.DEFAULT_PROJECT_NOT_SPECIFIED,
                impact=escalation.impact or strings.DEFAULT_IMPACT_UNDETERMINED,
                report_id=escalation.user_report_id,
            ),
        ]

        if workarounds or known_issues:
            lines.append("")
            lines.append(strings.ESCALATION_WORKAROUNDS_HEADER)
            if workarounds:
                for workaround in workarounds:
                    lines.append(f"- {workaround}")
            if known_issues:
                lines.append(strings.ESCALATION_KNOWN_ISSUES_TIP)

        return "\n".join(lines)

    def format_self_service_message(
        self,
        article_title: str,
        article_content: str,
        guide_steps: List[str],
    ) -> str:
        """
        Format a self-service guidance message for known issues.

        Uses the self-service guidance pattern from bot.md specification:
        - Lines 88-100: Self-Service Guidance Patterns

        Args:
            article_title: Title of the relevant knowledge base article.
            article_content: Summary of the known issue and solution.
            guide_steps: Ordered list of steps to resolve the issue.

        Returns:
            Formatted self-service guidance message string.
        """
        lines = [
            strings.ESCALATION_SELF_SERVICE_INTRO,
            "",
            article_title,
            "",
            article_content,
            "",
            strings.ESCALATION_STEPS_HEADER,
        ]

        for i, step in enumerate(guide_steps, start=1):
            lines.append(f"{i}. {step}")

        lines.extend(
            [
                "",
                strings.ESCALATION_NOT_RESOLVED_FOLLOWUP,
            ]
        )

        return "\n".join(lines)

    async def get_escalation_status(self, report_id: str) -> Optional[EscalationData]:
        """
        Fetch escalation status for a given report ID.

        Args:
            report_id: The ID of the user report to look up.

        Returns:
            EscalationData if found, None otherwise.
        """
        return await self.escalation_repo.get_by_report_id(report_id)
