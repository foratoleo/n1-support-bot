"""Data access layer for database operations.

Provides repository classes for CRUD operations on knowledge base
documents, user reports, conversations, and escalations.
"""

import logging
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Conversation, Escalation, KBDocument, UserReport

logger = logging.getLogger(__name__)


class KBDocumentRepository:
    """Repository for knowledge base document operations.

    Provides search and retrieval methods for KB documents
    used in RAG-based response generation.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with database session.

        Args:
            session: SQLAlchemy async session.
        """
        self.session = session

    async def search(
        self,
        query: str,
        area: Optional[str] = None,
        limit: int = 5
    ) -> List[KBDocument]:
        """Search documents by keyword using ILIKE.

        Performs a case-insensitive search on title and content fields.

        Args:
            query: Search query string.
            area: Optional area to filter by.
            limit: Maximum number of results to return.

        Returns:
            List of matching KBDocument objects.
        """
        stmt = select(KBDocument).where(
            (KBDocument.title.ilike(f"%{query}%")) |
            (KBDocument.content.ilike(f"%{query}%"))
        )

        if area:
            stmt = stmt.where(KBDocument.area == area)

        stmt = stmt.limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, doc_id: UUID) -> Optional[KBDocument]:
        """Get a document by its ID.

        Args:
            doc_id: UUID of the document.

        Returns:
            KBDocument if found, None otherwise.
        """
        stmt = select(KBDocument).where(KBDocument.id == doc_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_area(self, area: str) -> List[KBDocument]:
        """Get all documents in a specific area.

        Args:
            area: Area name to filter by.

        Returns:
            List of KBDocument objects in the area.
        """
        stmt = select(KBDocument).where(KBDocument.area == area)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self) -> int:
        """Count total number of documents.

        Returns:
            Total document count.
        """
        stmt = select(func.count()).select_from(KBDocument)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_file_path(self, file_path: str) -> Optional[KBDocument]:
        """Get a document by its source file path.

        Args:
            file_path: Path to the source file.

        Returns:
            KBDocument if found, None otherwise.
        """
        stmt = select(KBDocument).where(KBDocument.file_path == file_path)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        area: str,
        title: str,
        content: str,
        file_path: Optional[str] = None
    ) -> KBDocument:
        """Create a new knowledge base document.

        Args:
            area: Category or area this document belongs to.
            title: Document title or heading.
            content: Full text content of the document.
            file_path: Optional path to the source file.

        Returns:
            Created KBDocument object.
        """
        doc = KBDocument(
            area=area,
            title=title,
            content=content,
            file_path=file_path
        )
        self.session.add(doc)
        await self.session.commit()
        await self.session.refresh(doc)
        logger.info(f"Created KB document: {doc.title} (area={doc.area})")
        return doc


class UserReportRepository:
    """Repository for user report operations.

    Handles creation and management of user support reports.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with database session.

        Args:
            session: SQLAlchemy async session.
        """
        self.session = session

    async def create(
        self,
        description: str,
        user_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> UserReport:
        """Create a new user report.

        Args:
            description: User's description of the issue.
            user_id: Optional UUID of the reporting user.
            project_id: Optional UUID of the related project.

        Returns:
            Created UserReport object.
        """
        report = UserReport(
            description=description,
            user_id=user_id,
            project_id=project_id
        )
        self.session.add(report)
        await self.session.commit()
        await self.session.refresh(report)
        logger.info(f"Created user report: {report.id}")
        return report

    async def update_status(self, report_id: UUID, status: str) -> bool:
        """Update the status of a user report.

        Args:
            report_id: UUID of the report to update.
            status: New status value.

        Returns:
            True if update succeeded, False if report not found.
        """
        stmt = select(UserReport).where(UserReport.id == report_id)
        result = await self.session.execute(stmt)
        report = result.scalar_one_or_none()

        if not report:
            logger.warning(f"Report not found for status update: {report_id}")
            return False

        report.status = status
        await self.session.commit()
        logger.info(f"Updated report {report_id} status to: {status}")
        return True

    async def get_by_id(self, report_id: UUID) -> Optional[UserReport]:
        """Get a user report by ID.

        Args:
            report_id: UUID of the report.

        Returns:
            UserReport if found, None otherwise.
        """
        stmt = select(UserReport).where(UserReport.id == report_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user(self, user_id: UUID) -> List[UserReport]:
        """Get all reports for a specific user.

        Args:
            user_id: UUID of the user.

        Returns:
            List of UserReport objects for the user.
        """
        stmt = select(UserReport).where(UserReport.user_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_recent_by_user(self, user_id: UUID, limit: int = 5) -> List[UserReport]:
        """Get recent reports for a specific user.

        Args:
            user_id: UUID of the user.
            limit: Maximum number of reports to return.

        Returns:
            List of recent UserReport objects ordered by creation date.
        """
        stmt = (
            select(UserReport)
            .where(UserReport.user_id == user_id)
            .order_by(UserReport.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_rating(self, report_id: UUID, rating: int) -> bool:
        """Update the rating of a user report.

        Args:
            report_id: UUID of the report to update.
            rating: Rating value (1-5).

        Returns:
            True if update succeeded, False if report not found.
        """
        stmt = select(UserReport).where(UserReport.id == report_id)
        result = await self.session.execute(stmt)
        report = result.scalar_one_or_none()

        if not report:
            logger.warning(f"Report not found for rating update: {report_id}")
            return False

        report.rating = str(rating)
        await self.session.commit()
        logger.info(f"Updated report {report_id} rating to: {rating}")
        return True


class ConversationRepository:
    """Repository for conversation message operations.

    Manages conversation history for support interactions.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with database session.

        Args:
            session: SQLAlchemy async session.
        """
        self.session = session

    async def add_message(
        self,
        report_id: UUID,
        role: str,
        message: str
    ) -> Conversation:
        """Add a message to a conversation.

        Args:
            report_id: UUID of the parent user report.
            role: Message author role ('user' or 'bot').
            message: Text content of the message.

        Returns:
            Created Conversation object.
        """
        conversation = Conversation(
            user_report_id=report_id,
            role=role,
            message=message
        )
        self.session.add(conversation)
        await self.session.commit()
        await self.session.refresh(conversation)
        logger.debug(f"Added {role} message to report {report_id}")
        return conversation

    async def get_by_report(self, report_id: UUID) -> List[Conversation]:
        """Get all messages for a report.

        Args:
            report_id: UUID of the user report.

        Returns:
            List of Conversation objects ordered by creation time.
        """
        stmt = (
            select(Conversation)
            .where(Conversation.user_report_id == report_id)
            .order_by(Conversation.created_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class EscalationRepository:
    """Repository for escalation operations.

    Handles creation and management of support escalations
    to human agents.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with database session.

        Args:
            session: SQLAlchemy async session.
        """
        self.session = session

    async def create(
        self,
        report_id: UUID,
        summary: str,
        project_name: Optional[str] = None,
        impact: Optional[str] = None,
        assigned_to: Optional[UUID] = None
    ) -> Escalation:
        """Create a new escalation.

        Args:
            report_id: UUID of the parent user report.
            summary: Brief summary of escalation reason.
            project_name: Optional project name.
            impact: Optional impact description.
            assigned_to: Optional UUID of assigned agent.

        Returns:
            Created Escalation object.
        """
        escalation = Escalation(
            user_report_id=report_id,
            summary=summary,
            project_name=project_name,
            impact=impact,
            assigned_to=assigned_to
        )
        self.session.add(escalation)
        await self.session.commit()
        await self.session.refresh(escalation)
        logger.info(f"Created escalation: {escalation.id}")
        return escalation

    async def get_by_report(self, report_id: UUID) -> Optional[Escalation]:
        """Get escalation for a report.

        Args:
            report_id: UUID of the user report.

        Returns:
            Escalation if found, None otherwise.
        """
        stmt = select(Escalation).where(Escalation.user_report_id == report_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(self, escalation_id: UUID, status: str) -> bool:
        """Update the status of an escalation.

        Args:
            escalation_id: UUID of the escalation to update.
            status: New status value.

        Returns:
            True if update succeeded, False if not found.
        """
        stmt = select(Escalation).where(Escalation.id == escalation_id)
        result = await self.session.execute(stmt)
        escalation = result.scalar_one_or_none()

        if not escalation:
            logger.warning(f"Escalation not found: {escalation_id}")
            return False

        escalation.status = status
        await self.session.commit()
        logger.info(f"Updated escalation {escalation_id} status to: {status}")
        return True
