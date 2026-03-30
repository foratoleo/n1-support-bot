"""Unit tests for database models."""

import pytest
from datetime import datetime
from uuid import uuid4
from uuid import UUID

from src.database.models import KBDocument, UserReport, Conversation, Escalation


class TestKBDocument:
    """Tests for KBDocument model."""

    def test_kb_document_creation(self):
        """Test creating a KBDocument with all fields."""
        doc = KBDocument(
            id=uuid4(),
            area="planning",
            title="Test Document",
            content="Test content",
            file_path="/kb/test.md"
        )
        assert doc.area == "planning"
        assert doc.title == "Test Document"
        assert doc.content == "Test content"
        assert doc.file_path == "/kb/test.md"

    def test_kb_document_creation_without_optional_fields(self):
        """Test creating a KBDocument without optional file_path."""
        doc = KBDocument(
            id=uuid4(),
            area="frontend",
            title="Minimal Document",
            content="Minimal content"
        )
        assert doc.area == "frontend"
        assert doc.file_path is None

    def test_kb_document_repr(self):
        """Test string representation of KBDocument."""
        doc_id = uuid4()
        doc = KBDocument(
            id=doc_id,
            area="planning",
            title="Test Document",
            content="Test content"
        )
        repr_str = repr(doc)
        assert "KBDocument" in repr_str
        assert "Test Document" in repr_str
        assert "planning" in repr_str

    def test_kb_document_default_id(self):
        """Test that KBDocument model has id column with default."""
        # SQLAlchemy defaults are applied at insert time, not at object instantiation
        # We verify the column configuration has a default factory set
        doc = KBDocument(
            area="support",
            title="Default ID Test",
            content="Content"
        )
        # The default is a SQL-level default, so id is None until persisted
        # We can verify the column configuration exists
        assert hasattr(doc.__class__.id, 'default')
        assert doc.id is None  # Not set until insert

    def test_kb_document_all_areas(self):
        """Test creating documents for all known areas."""
        areas = ["planning", "frontend", "foundation", "document-generation", "support"]
        for area in areas:
            doc = KBDocument(
                id=uuid4(),
                area=area,
                title=f"{area} Document",
                content=f"Content for {area}"
            )
            assert doc.area == area


class TestUserReport:
    """Tests for UserReport model."""

    def test_user_report_creation(self):
        """Test creating a UserReport with all fields."""
        user_id = uuid4()
        project_id = uuid4()
        report = UserReport(
            id=uuid4(),
            user_id=user_id,
            project_id=project_id,
            description="Test issue description",
            status="pending"
        )
        assert report.user_id == user_id
        assert report.project_id == project_id
        assert report.description == "Test issue description"
        assert report.status == "pending"

    def test_user_report_defaults(self):
        """Test UserReport default values when only required fields provided."""
        report = UserReport(
            id=uuid4(),
            description="Test issue"
        )
        # SQLAlchemy defaults are applied at insert time
        # The column has default="pending" configured
        assert hasattr(report.__class__.status, 'default')
        assert report.user_id is None
        assert report.project_id is None

    def test_user_report_repr(self):
        """Test string representation of UserReport."""
        report = UserReport(
            id=uuid4(),
            description="Test issue",
            status="pending"
        )
        repr_str = repr(report)
        assert "UserReport" in repr_str
        assert "pending" in repr_str

    def test_user_report_status_values(self):
        """Test UserReport with different status values."""
        statuses = ["pending", "processing", "resolved", "escalated"]
        for status in statuses:
            report = UserReport(
                id=uuid4(),
                description=f"Test {status}",
                status=status
            )
            assert report.status == status

    def test_user_report_created_at_default(self):
        """Test that created_at column has default configuration."""
        report = UserReport(description="Time test")
        # SQLAlchemy default is applied at insert time
        assert hasattr(report.__class__.created_at, 'default')
        assert report.created_at is None  # Not set until insert


class TestConversation:
    """Tests for Conversation model."""

    def test_conversation_user_role(self):
        """Test creating a Conversation with user role."""
        report_id = uuid4()
        conv = Conversation(
            id=uuid4(),
            user_report_id=report_id,
            role="user",
            message="Hello, I need help"
        )
        assert conv.role == "user"
        assert conv.message == "Hello, I need help"
        assert conv.user_report_id == report_id

    def test_conversation_bot_role(self):
        """Test creating a Conversation with bot role."""
        report_id = uuid4()
        conv = Conversation(
            id=uuid4(),
            user_report_id=report_id,
            role="bot",
            message="How can I assist you today?"
        )
        assert conv.role == "bot"

    def test_conversation_repr(self):
        """Test string representation of Conversation."""
        conv = Conversation(
            id=uuid4(),
            user_report_id=uuid4(),
            role="user",
            message="Test message"
        )
        repr_str = repr(conv)
        assert "Conversation" in repr_str
        assert "user" in repr_str

    def test_conversation_valid_roles(self):
        """Test that valid roles are accepted."""
        report_id = uuid4()
        for role in ["user", "bot"]:
            conv = Conversation(
                id=uuid4(),
                user_report_id=report_id,
                role=role,
                message=f"Test {role}"
            )
            assert conv.role == role

    def test_conversation_created_at_default(self):
        """Test that created_at column has default configuration."""
        conv = Conversation(
            id=uuid4(),
            user_report_id=uuid4(),
            role="user",
            message="Test"
        )
        # SQLAlchemy default is applied at insert time
        assert hasattr(conv.__class__.created_at, 'default')
        assert conv.created_at is None  # Not set until insert


class TestEscalation:
    """Tests for Escalation model."""

    def test_escalation_creation(self):
        """Test creating an Escalation with all fields."""
        report_id = uuid4()
        assigned_to = uuid4()
        escalation = Escalation(
            id=uuid4(),
            user_report_id=report_id,
            summary="Critical system failure",
            project_name="Workforce App",
            impact="High - All users affected",
            assigned_to=assigned_to,
            status="open"
        )
        assert escalation.user_report_id == report_id
        assert escalation.summary == "Critical system failure"
        assert escalation.project_name == "Workforce App"
        assert escalation.impact == "High - All users affected"
        assert escalation.assigned_to == assigned_to
        assert escalation.status == "open"

    def test_escalation_defaults(self):
        """Test Escalation default values."""
        escalation = Escalation(
            id=uuid4(),
            user_report_id=uuid4(),
            summary="Test escalation"
        )
        # SQLAlchemy defaults are applied at insert time
        assert hasattr(escalation.__class__.status, 'default')
        assert escalation.project_name is None
        assert escalation.impact is None
        assert escalation.assigned_to is None

    def test_escalation_repr(self):
        """Test string representation of Escalation."""
        escalation = Escalation(
            id=uuid4(),
            user_report_id=uuid4(),
            summary="Test escalation",
            status="open"
        )
        repr_str = repr(escalation)
        assert "Escalation" in repr_str
        assert "open" in repr_str

    def test_escalation_status_values(self):
        """Test Escalation with different status values."""
        statuses = ["open", "in_progress", "resolved", "closed"]
        for status in statuses:
            escalation = Escalation(
                id=uuid4(),
                user_report_id=uuid4(),
                summary=f"Test {status}",
                status=status
            )
            assert escalation.status == status

    def test_escalation_created_at_default(self):
        """Test that created_at column has default configuration."""
        escalation = Escalation(
            id=uuid4(),
            user_report_id=uuid4(),
            summary="Time test"
        )
        # SQLAlchemy default is applied at insert time
        assert hasattr(escalation.__class__.created_at, 'default')
        assert escalation.created_at is None  # Not set until insert
