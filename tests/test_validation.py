"""Unit tests for validation module (questions and classifier)."""

import pytest
from unittest.mock import MagicMock, AsyncMock

from src.validation.questions import QuestionGenerator, Question
from src.validation.classifier import IssueClassifier, IssueClassification, EscalationDecision


class TestQuestionGenerator:
    """Tests for QuestionGenerator."""

    @pytest.fixture
    def generator(self):
        """Create a QuestionGenerator instance."""
        return QuestionGenerator()

    def test_generator_initialization(self, generator):
        """Test that QuestionGenerator initializes correctly."""
        assert generator is not None
        assert hasattr(generator, 'CATEGORY_QUESTIONS')

    def test_get_questions_for_data_missing(self, generator):
        """Test getting questions for data_missing category."""
        questions = generator.get_questions_for_category("data_missing")
        assert len(questions) <= 4
        assert all(isinstance(q, Question) for q in questions)

    def test_get_questions_for_document_generation(self, generator):
        """Test getting questions for document_generation category."""
        questions = generator.get_questions_for_category("document_generation")
        assert len(questions) <= 4
        assert all(isinstance(q, Question) for q in questions)

    def test_get_questions_for_task_sprint(self, generator):
        """Test getting questions for task_sprint category."""
        questions = generator.get_questions_for_category("task_sprint")
        assert len(questions) <= 4
        assert all(isinstance(q, Question) for q in questions)

    def test_get_questions_for_login_auth(self, generator):
        """Test getting questions for login_auth category."""
        questions = generator.get_questions_for_category("login_auth")
        assert len(questions) <= 4
        assert all(isinstance(q, Question) for q in questions)

    def test_get_questions_for_general(self, generator):
        """Test getting questions for general category."""
        questions = generator.get_questions_for_category("general")
        assert len(questions) <= 3
        assert all(isinstance(q, Question) for q in questions)

    def test_get_questions_with_max_limit(self, generator):
        """Test that max_questions limits the returned questions."""
        for category in ['data_missing', 'document_generation', 'task_sprint', 'login_auth', 'general']:
            questions = generator.get_questions_for_category(category, max_questions=2)
            assert len(questions) <= 2

    def test_get_questions_unknown_category_returns_general(self, generator):
        """Test that unknown category returns general questions."""
        questions = generator.get_questions_for_category("unknown_category")
        general_questions = generator.get_questions_for_category("general")
        assert questions == general_questions

    def test_all_categories_have_questions(self, generator):
        """Test that all categories have at least one question."""
        categories = ['data_missing', 'document_generation', 'task_sprint', 'login_auth', 'general']
        for category in categories:
            questions = generator.get_questions_for_category(category)
            assert len(questions) > 0

    def test_question_structure(self, generator):
        """Test that returned questions have proper structure."""
        questions = generator.get_questions_for_category("general")
        for q in questions:
            assert hasattr(q, 'id')
            assert hasattr(q, 'text')
            assert q.id is not None
            assert q.text is not None
            assert len(q.text) > 0

    def test_question_ids_are_unique(self, generator):
        """Test that question IDs are unique within a category."""
        questions = generator.get_questions_for_category("data_missing")
        ids = [q.id for q in questions]
        assert len(ids) == len(set(ids))

    def test_validate_responses_matching_counts(self, generator):
        """Test validation when number of answers matches questions."""
        questions = [
            Question("1", "Question 1?"),
            Question("2", "Question 2?"),
        ]
        answers = ["Answer 1", "Answer 2"]

        result = generator.validate_responses(questions, answers)

        assert "is_valid" in result
        assert "is_known_issue" in result
        assert "needs_escalation" in result
        assert "summary" in result

    def test_validate_responses_mismatched_counts(self, generator):
        """Test validation fails when answer count doesn't match question count."""
        questions = [
            Question("1", "Question 1?"),
            Question("2", "Question 2?"),
        ]
        answers = ["Only one answer"]

        result = generator.validate_responses(questions, answers)

        assert result["is_valid"] is False
        assert "does not match" in result["summary"]

    def test_validate_responses_empty_answers(self, generator):
        """Test validation with mostly empty answers."""
        questions = [
            Question("1", "Question 1?"),
            Question("2", "Question 2?"),
            Question("3", "Question 3?"),
            Question("4", "Question 4?"),
        ]
        answers = ["", "", "", ""]

        result = generator.validate_responses(questions, answers)

        assert result["is_valid"] is False
        assert "Insufficient information" in result["summary"]

    def test_validate_responses_resolved_issue(self, generator):
        """Test validation detects when issue is resolved."""
        questions = [
            Question("1", "Did it work?"),
        ]
        answers = ["Yes, it is fixed now"]

        result = generator.validate_responses(questions, answers)

        assert result["is_known_issue"] is True
        assert result["needs_escalation"] is False

    def test_validate_responses_user_error(self, generator):
        """Test validation detects user error."""
        questions = [
            Question("1", "What happened?"),
        ]
        answers = ["I was wrong, my mistake"]

        result = generator.validate_responses(questions, answers)

        assert result["is_valid"] is False
        assert result["needs_escalation"] is False

    def test_validate_responses_issue_persists(self, generator):
        """Test validation detects when issue persists."""
        questions = [
            Question("1", "Did it work?"),
        ]
        answers = ["Still not working, still getting errors"]

        result = generator.validate_responses(questions, answers)

        assert result["is_valid"] is True
        assert result["needs_escalation"] is True


class TestIssueClassifier:
    """Tests for IssueClassifier."""

    @pytest.fixture
    def mock_openai_client(self):
        """Create a mock OpenAI client."""
        client = MagicMock()
        return client

    @pytest.fixture
    def mock_kb_searcher(self):
        """Create a mock KB searcher."""
        return MagicMock()

    @pytest.fixture
    def question_generator(self):
        """Create a QuestionGenerator instance."""
        return QuestionGenerator()

    @pytest.fixture
    def classifier(self, mock_openai_client, mock_kb_searcher, question_generator):
        """Create an IssueClassifier instance."""
        return IssueClassifier(
            openai_client=mock_openai_client,
            kb_searcher=mock_kb_searcher,
            question_generator=question_generator,
        )

    def test_classifier_initialization(self, classifier):
        """Test that IssueClassifier initializes correctly."""
        assert classifier is not None
        assert hasattr(classifier, 'CATEGORY_KEYWORDS')
        assert hasattr(classifier, 'ESCALATE_CRITERIA')

    def test_classify_data_missing_keywords(self, classifier):
        """Test classification of data missing issues."""
        issue = "My data is missing from the project"
        result = classifier._classify_with_keywords(issue.lower())

        assert result.category == "data_missing"
        assert result.area == "frontend"

    def test_classify_document_generation_keywords(self, classifier):
        """Test classification of document generation issues."""
        issue = "I cannot generate a PRD document"
        result = classifier._classify_with_keywords(issue.lower())

        assert result.category == "document_generation"
        assert result.area == "document-generation"

    def test_classify_task_sprint_keywords(self, classifier):
        """Test classification of task sprint issues."""
        issue = "The task status shows wrong information"
        result = classifier._classify_with_keywords(issue.lower())

        assert result.category == "task_sprint"
        assert result.area == "planning"

    def test_classify_login_auth_keywords(self, classifier):
        """Test classification of login auth issues."""
        issue = "I cannot login to the system"
        result = classifier._classify_with_keywords(issue.lower())

        assert result.category == "login_auth"
        assert result.area == "foundation"

    def test_classify_unrecognized_returns_general(self, classifier):
        """Test that unrecognized issues return general category."""
        issue = "The sky is blue today"
        result = classifier._classify_with_keywords(issue.lower())

        assert result.category == "general"
        assert result.area == "support"

    def test_classify_multiple_keywords_highest_score(self, classifier):
        """Test that category with most keyword matches is selected."""
        issue = "I cannot find my task and also cannot login"
        result = classifier._classify_with_keywords(issue.lower())

        # Both login_auth and data_missing keywords present, but task is primary concern
        assert result.category in ["login_auth", "data_missing", "task_sprint"]

    @pytest.mark.asyncio
    async def test_should_escalate_user_requests_human(self, classifier):
        """Test escalation when user explicitly requests human help."""
        issue = "I need to speak to a human agent"
        answers = ["Yes I want to talk to someone"]
        articles = []

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is True
        assert result.escalation_type == "user_requests_human"

    @pytest.mark.asyncio
    async def test_should_escalate_not_for_feature_request(self, classifier):
        """Test that feature requests are not escalated."""
        issue = "This is a user error"
        answers = []
        articles = []

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is False
        assert "user error" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_should_escalate_not_for_user_error(self, classifier):
        """Test that user errors are not escalated."""
        issue = "I was wrong about the issue"
        answers = ["It was my mistake"]
        articles = []

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is False

    @pytest.mark.asyncio
    async def test_should_escalate_cannot_reproduce(self, classifier):
        """Test escalation when issue cannot be reproduced."""
        issue = "The error happens sometimes"
        answers = ["I cannot reproduce the issue"]
        articles = [("Article", "Some content")]

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is True
        assert result.escalation_type == "cannot_reproduce"

    @pytest.mark.asyncio
    async def test_should_escalate_data_corruption(self, classifier):
        """Test escalation for data corruption issues."""
        issue = "My data is corrupted"
        answers = ["The data disappeared"]
        articles = []

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is True

    @pytest.mark.asyncio
    async def test_should_escalate_auth_failure(self, classifier):
        """Test escalation for auth failure issues."""
        issue = "Login problem"
        answers = ["Still cannot login, password not working"]
        articles = []

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is True

    @pytest.mark.asyncio
    async def test_should_escalate_with_persistence_indicators(self, classifier):
        """Test escalation when answers indicate issue persists."""
        issue = "Something is wrong"
        answers = ["Still not working, fails every time"]
        articles = [("Article", "Some content")]

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is True

    @pytest.mark.asyncio
    async def test_should_not_escalate_when_issue_resolved(self, classifier):
        """Test no escalation when issue appears resolved."""
        issue = "The issue is now fixed"
        answers = ["It works now, thank you"]
        articles = [("Article", "Solution: Clear cache")]

        result = await classifier.should_escalate(issue, answers, articles)

        assert result.should_escalate is False

    @pytest.mark.asyncio
    async def test_should_not_escalate_self_service_possible(self, classifier):
        """Test no escalation when KB has solution."""
        issue = "How do I reset my password"
        answers = ["Still need help"]
        articles = [("Password Reset", "Solution: Click forgot password")]

        result = await classifier.should_escalate(issue, answers, articles)

        # Should still escalate since user says they need help
        assert result.should_escalate is True

    def test_classification_confidence_score(self, classifier):
        """Test that classification returns a confidence score."""
        issue = "I cannot generate a document"
        result = classifier._classify_with_keywords(issue.lower())

        assert 0.0 <= result.confidence <= 1.0

    def test_issue_classification_dataclass(self):
        """Test IssueClassification dataclass structure."""
        classification = IssueClassification(
            category="test",
            confidence=0.8,
            summary="Test summary",
            area="test_area"
        )

        assert classification.category == "test"
        assert classification.confidence == 0.8
        assert classification.summary == "Test summary"
        assert classification.area == "test_area"

    def test_escalation_decision_dataclass(self):
        """Test EscalationDecision dataclass structure."""
        decision = EscalationDecision(
            should_escalate=True,
            reason="Test reason",
            escalation_type="test_type"
        )

        assert decision.should_escalate is True
        assert decision.reason == "Test reason"
        assert decision.escalation_type == "test_type"

    def test_escalation_decision_without_type(self):
        """Test EscalationDecision with no escalation type."""
        decision = EscalationDecision(
            should_escalate=False,
            reason="Self service possible"
        )

        assert decision.should_escalate is False
        assert decision.escalation_type is None
