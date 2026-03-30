"""SQLAlchemy ORM models for the RAG support bot database.

Defines the database schema for knowledge base documents, user reports,
conversations, and escalations using SQLAlchemy ORM with PostgreSQL.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class KBDocument(Base):
    """Knowledge base document model.

    Stores indexed documents from the knowledge base that can be
    searched to provide contextual responses to user queries.

    Attributes:
        id: Unique identifier (UUID).
        area: Category or area this document belongs to.
        title: Document title or heading.
        content: Full text content of the document.
        file_path: Optional path to the source file.
        created_at: Timestamp when document was indexed.
    """

    __tablename__ = "kb_documents"
    __table_args__ = {"schema": "rag"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    area = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    file_path = Column(Text, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<KBDocument(id={self.id}, title='{self.title}', area='{self.area}')>"


class UserReport(Base):
    """User report model for tracking support requests.

    Represents a user-submitted support request or issue report
    that may be handled by the bot or escalated to a human.

    Attributes:
        id: Unique identifier (UUID).
        user_id: UUID of the user who submitted the report.
        project_id: UUID of the project this report relates to.
        description: User's description of the issue.
        status: Current status (pending, processing, resolved, escalated).
        created_at: Timestamp when report was created.
    """

    __tablename__ = "user_reports"
    __table_args__ = {"schema": "rag"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(Text, nullable=False)
    status = Column(Text, default="pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<UserReport(id={self.id}, status='{self.status}')>"


class Conversation(Base):
    """Conversation message model for tracking dialogue.

    Stores individual messages in a conversation related to a
    user report, either from the user or the bot.

    Attributes:
        id: Unique identifier (UUID).
        user_report_id: UUID of the parent user report.
        role: Message author role ('user' or 'bot').
        message: Text content of the message.
        created_at: Timestamp when message was sent.
    """

    __tablename__ = "conversations"
    __table_args__ = {"schema": "rag"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rag.user_reports.id"),
        nullable=False
    )
    role = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, role='{self.role}')>"


class Escalation(Base):
    """Escalation model for human handoff.

    Represents an escalated support request that requires
    human agent intervention.

    Attributes:
        id: Unique identifier (UUID).
        user_report_id: UUID of the parent user report.
        summary: Brief summary of the escalation reason.
        project_name: Name of the project related to escalation.
        impact: Description of the impact or urgency.
        assigned_to: UUID of the agent assigned to handle.
        status: Current status (open, in_progress, resolved, closed).
        created_at: Timestamp when escalation was created.
    """

    __tablename__ = "escalations"
    __table_args__ = {"schema": "rag"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rag.user_reports.id"),
        nullable=False
    )
    summary = Column(Text, nullable=False)
    project_name = Column(Text, nullable=True)
    impact = Column(Text, nullable=True)
    assigned_to = Column(UUID(as_uuid=True), nullable=True)
    status = Column(Text, default="open")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<Escalation(id={self.id}, status='{self.status}')>"
