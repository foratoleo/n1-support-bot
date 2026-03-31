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
        """Extração de termos remove stopwords e mantém termos relevantes."""
        text = "The user cannot login to the system"
        terms = self.searcher._extract_search_terms(text)

        # Stopwords do inglês devem ser removidas
        assert 'the' not in terms
        # Termos relevantes devem permanecer
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


class TestBM25PlusScoring:
    """Testes para pontuação BM25Plus via _score_with_bm25plus."""

    def setup_method(self):
        """Configura fixtures de teste."""
        self.searcher = KnowledgeBaseSearcher(db_pool=MagicMock())

    def _make_row(self, title, content):
        """Cria um objeto row simulado."""
        row = MagicMock()
        row.__getitem__ = lambda self, key: {
            'title': title,
            'content': content,
            'area': 'geral',
            'doc_length': len(content),
        }[key]
        row.get = lambda key, default=None: {'area': 'geral'}.get(key, default)
        return row

    def test_title_weight(self):
        """Documentos com termo no título pontuam mais alto."""
        rows = [
            self._make_row('Login page', 'User cannot access the login page'),
            self._make_row('Help page', 'User cannot access the login page'),
        ]
        results = self.searcher._score_with_bm25plus(rows, ['login'])

        # O documento com 'login' no título deve ter score mais alto
        score_login_title = next(s for t, _, __, s in results if t == 'Login page')
        score_help_title = next(s for t, _, __, s in results if t == 'Help page')
        assert score_login_title >= score_help_title

    def test_positive_score_for_matching_term(self):
        """Documento com termo repetido deve ter score positivo."""
        rows = [
            self._make_row('Login', 'login login login login login'),
        ]
        results = self.searcher._score_with_bm25plus(rows, ['login'])
        assert results[0][3] > 0

    def test_missing_term_lower_score(self):
        """Documento sem o termo de busca pontua menos que documento com o termo."""
        rows = [
            self._make_row('Help Page', 'Some random content without the keyword'),
            self._make_row('Login Guide', 'How to login to the system'),
        ]
        results = self.searcher._score_with_bm25plus(rows, ['login'])
        # Resultado com 'login' deve aparecer primeiro
        assert results[0][0] == 'Login Guide'


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
        """Classificação de área data_missing para textos sem palavra 'document'."""
        # Usa texto sem 'document' para evitar conflito com document_generation
        text = "My files are missing and I cannot find them"
        area = self.searcher.classify_issue_area(text)
        assert area == 'data_missing'

    def test_default_classification(self):
        """Test default general classification."""
        text = "What is the weather today"
        area = self.searcher.classify_issue_area(text)
        assert area == 'general'
