"""Tests for knowledge base search with BM25 ranking."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from rag.knowledge_base import KnowledgeBaseSearcher, STOPWORDS, RELATED_TERMS


class TestExtractSearchTerms:
    """Tests for _extract_search_terms method."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_basic_term_extraction(self):
        """Test basic term extraction removes stopwords."""
        text = "The user cannot login to the system"
        terms = self.searcher._extract_search_terms(text)
        
        assert 'the' not in terms
        assert 'user' not in terms  # removed by stopwords
        assert 'cannot' in terms
        assert 'login' in terms
        assert 'system' in terms

    def test_multilanguage_stopwords(self):
        """Test stopwords from multiple languages are removed."""
        text = "the a los um uma"
        terms = self.searcher._extract_search_terms(text)
        
        assert 'the' not in terms
        assert 'a' not in terms
        assert 'los' not in terms
        assert 'um' not in terms
        assert 'uma' not in terms

    def test_phrase_detection(self):
        """Test multi-word phrases are detected."""
        text = "user story format is wrong"
        terms = self.searcher._extract_search_terms(text)
        
        assert 'user story' in terms

    def test_empty_query(self):
        """Test empty query returns empty list."""
        terms = self.searcher._extract_search_terms("")
        assert terms == []

    def test_short_words_filtered(self):
        """Test words shorter than 2 chars are filtered."""
        text = "a b c d e"
        terms = self.searcher._extract_search_terms(text)
        assert len(terms) == 0


class TestExpandQueryTerms:
    """Tests for query expansion."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_direct_expansion(self):
        """Test direct related term expansion."""
        terms = ['login']
        expanded = self.searcher._expand_query_terms(terms)
        
        assert 'login' in expanded
        assert 'signin' in expanded
        assert 'password' in expanded
        assert 'credential' in expanded

    def test_auth_related_expansion(self):
        """Test authentication-related term expansion."""
        terms = ['password', 'session']
        expanded = self.searcher._expand_query_terms(terms)
        
        # Password related
        assert 'password' in expanded
        assert 'credential' in expanded
        # Session related
        assert 'session' in expanded
        assert 'token' in expanded

    def test_no_expansion_for_unknown(self):
        """Test no expansion for unknown terms."""
        terms = ['unknownterm123']
        expanded = self.searcher._expand_query_terms(terms)
        
        assert expanded == ['unknownterm123']


class TestDeduplicateResults:
    """Tests for result deduplication."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_duplicate_title_removed(self):
        """Test duplicate titles are removed."""
        results = [
            ('Title A', 'Content A', 'area1', 10.0),
            ('Title A', 'Content B', 'area2', 8.0),
            ('Title B', 'Content C', 'area3', 6.0),
        ]
        
        deduped = self.searcher._deduplicate_results(results)
        
        assert len(deduped) == 2
        assert ('Title A', 'Content A', 'area1', 10.0) in deduped
        assert ('Title B', 'Content C', 'area3', 6.0) in deduped

    def test_similar_content_removed(self):
        """Test similar content signatures are removed."""
        results = [
            ('Title A', 'Same content here...', 'area1', 10.0),
            ('Title B', 'Same content here...', 'area2', 8.0),
        ]
        
        deduped = self.searcher._deduplicate_results(results)
        
        assert len(deduped) == 1

    def test_empty_results(self):
        """Test empty results return empty."""
        deduped = self.searcher._deduplicate_results([])
        assert deduped == []


class TestBM25Scoring:
    """Tests for BM25 scoring calculations."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())
        self.searcher._doc_stats_cache = 100
        self.searcher._avg_doc_length = 500

    def test_title_weight(self):
        """Test title matches score higher than content matches."""
        # Same content, but term appears in title in second doc
        score1 = self.searcher._calculate_bm25_score(
            'Login page', 'User cannot access the login page', ['login'], 50
        )
        score2 = self.searcher._calculate_bm25_score(
            'Help page', 'User cannot access the login page', ['login'], 50
        )
        
        assert score1 > score2

    def test_term_frequency_saturation(self):
        """Test BM25 saturation with high term frequency."""
        score = self.searcher._calculate_bm25_score(
            'Login', 'login login login login login', ['login'], 10
        )
        
        # Score should be positive
        assert score > 0
        
    def test_missing_term_score(self):
        """Test documents without search terms score zero."""
        score = self.searcher._calculate_bm25_score(
            'Help Page', 'Some random content', ['login'], 10
        )
        
        assert score == 0.0


class TestHybridSearch:
    """Tests for hybrid search with GPT-4o re-ranking."""

    def test_reranking_fallback_without_client(self):
        """Test re-ranking falls back when no OpenAI client."""
        searcher = KnowledgeBaseSearcher(
            db_pool=MagicMock(),
            openai_client=None,
            enable_reranking=True
        )
        
        assert not searcher.enable_reranking

    def test_reranking_disabled_by_default(self):
        """Test re-ranking is disabled when not specified."""
        searcher = KnowledgeBaseSearcher(
            db_pool=MagicMock(),
            openai_client=MagicMock(),
            enable_reranking=False
        )
        
        assert not searcher.enable_reranking

    def test_backward_compatibility(self):
        """Test basic search works without OpenAI client."""
        searcher = KnowledgeBaseSearcher(
            db_pool=MagicMock(),
            embedding_generator=None,
            openai_client=None
        )
        
        assert searcher.embedding_generator is None
        assert searcher.openai_client is None
        assert not searcher.enable_reranking


class TestClassifyIssueArea:
    """Tests for issue area classification."""

    def setup_method(self):
        """Set up test fixtures."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def test_document_generation_classification(self):
        """Test document generation area classification."""
        text = "How to generate a PRD document"
        area = self.searcher.classify_issue_area(text)
        assert area == 'document_generation'

    def test_login_auth_classification(self):
        """Test login/auth area classification."""
        text = "Cannot login with my password"
        area = self.searcher.classify_issue_area(text)
        assert area == 'login_auth'

    def test_task_sprint_classification(self):
        """Test task/sprint area classification."""
        text = "How to assign a task in the sprint"
        area = self.searcher.classify_issue_area(text)
        assert area == 'task_sprint'

    def test_data_missing_classification(self):
        """Test data missing area classification."""
        text = "My documents are missing"
        area = self.searcher.classify_issue_area(text)
        assert area == 'data_missing'

    def test_default_classification(self):
        """Test default general classification."""
        text = "What is the weather today"
        area = self.searcher.classify_issue_area(text)
        assert area == 'general'
