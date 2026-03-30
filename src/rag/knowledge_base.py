"""Knowledge base search for RAG-powered support bot with BM25 ranking and hybrid search."""

from typing import List, Tuple, Optional, Dict, Any
import re
import math
from collections import Counter

from .embeddings import EmbeddingGenerator

# Common stopwords for multiple languages
STOPWORDS = {
    'en': {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
           'was', 'one', 'our', 'out', 'what', 'when', 'where', 'who', 'how', 'this',
           'that', 'with', 'from', 'they', 'have', 'been', 'were', 'being', 'have',
           'has', 'has', 'its', 'it', 'its', 'just', 'only', 'also', 'very', 'more',
           'most', 'some', 'any', 'each', 'few', 'many', 'much', 'such', 'into',
           'about', 'after', 'before', 'between', 'under', 'again', 'then', 'once',
           'here', 'there', 'why', 'will', 'would', 'could', 'should', 'may', 'might',
           'must', 'shall', 'need', 'like', 'get', 'got', 'getting', 'make', 'made'},
    'pt': {'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'em', 'no', 'na',
           'que', 'e', 'para', 'com', 'por', 'se', 'mais', 'como', 'mas', 'foi',
           'tem', 'isso', 'esta', 'ele', 'ela', 'nao', 'sim', 'ou', 'ao', 'sua',
           'seu', 'muito', 'ja', 'so', 'ate', 'bem', 'ser', 'estao', 'estamos'},
    'es': {'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'que', 'y',
           'es', 'por', 'con', 'para', 'se', 'las', 'los', 'como', 'mas', 'fue',
           'tiene', 'esto', 'esta', 'el', 'no', 'si', 'o', 'al', 'su', 'muy',
           'ya', 'solo', 'hasta', 'bien', 'ser', 'son', 'esta', 'estamos'}
}

# Related terms expansion dictionary for common support terms
RELATED_TERMS = {
    # Authentication related
    'login': ['signin', 'sign in', 'access', 'password', 'credential', 'authentication', 'auth'],
    'logout': ['sign out', 'signout', 'exit', 'session', 'close'],
    'password': ['senha', 'pwd', 'pass', 'credential', 'auth'],
    'session': ['token', 'jwt', 'cookie', 'expire', 'timeout', 'expired'],
    '2fa': ['two factor', 'mfa', 'totp', 'authenticator', 'verification code'],
    'auth': ['authentication', 'authorize', 'credential', 'login', 'access'],
    
    # Document related
    'document': ['doc', 'file', 'pdf', 'report', 'transcript', 'prd', 'spec'],
    'generate': ['create', 'make', 'build', 'produce', 'generate', 'gerar', 'criar'],
    'template': ['modelo', 'pattern', 'boilerplate', 'example', 'sample'],
    'transcript': ['transcricao', 'recording', 'audio', 'minutes', 'notes'],
    'prd': ['product requirements', 'specification', 'spec', 'requirements doc'],
    'user story': ['story', 'requirement', 'feature', 'backlog item'],
    
    # Task/Sprint related
    'task': ['tarefa', 'todo', 'item', 'assignment', 'job'],
    'sprint': ['sprint', 'iteration', 'cycle', 'sprin'],
    'kanban': ['board', 'column', 'lane', 'workflow', 'status'],
    'backlog': ['queue', 'pending', 'todo list', 'sprint backlog'],
    'status': ['state', 'condition', 'progress', 'estado', 'situacao'],
    'assign': ['allocate', 'delegate', 'set', 'asignar', 'atribuir'],
    'blocked': ['blocked', 'stuck', 'waiting', 'impeded', 'obstacle'],
    
    # Data related
    'missing': ['not found', 'lost', 'vanished', 'gone', 'empty', 'null', 'none'],
    'not found': ['missing', '404', 'error', 'doesnt exist', 'no existe'],
    'error': ['bug', 'issue', 'problem', 'falha', 'erro', 'fail'],
    'data': ['information', 'content', 'record', 'entry', 'dados'],
    
    # UI/Display related
    'display': ['show', 'display', 'view', 'render', 'exibir', 'mostrar'],
    'button': ['click', 'press', 'action', 'botao', 'click'],
    'screen': ['page', 'view', 'interface', 'tela', 'pantalla'],
    'loading': ['carregando', 'loading', 'wait', 'spinner', 'processing'],
    
    # General
    'user': ['usuario', 'user', 'member', 'participant', 'client'],
    'project': ['workspace', 'team', 'organization', 'projeto', 'projecto'],
    'help': ['support', 'assist', 'aid', 'guia', 'ayuda', 'support'],
    'issue': ['problem', 'bug', 'error', 'difficulty', 'problema'],
    'impossible': ['cannot', 'cant', 'unable', 'failing', 'nao pode', 'no puede'],
}


class KnowledgeBaseSearcher:
    """Searches knowledge base for relevant articles to support user issues.
    
    Features:
    - BM25 ranking for keyword search
    - Query expansion with related terms
    - Result deduplication
    - Hybrid search with GPT-4o re-ranking (optional)
    """

    def __init__(
        self,
        db_pool,
        embedding_generator: EmbeddingGenerator = None,
        openai_client=None,
        enable_reranking: bool = False
    ):
        """Initialize the knowledge base searcher.

        Args:
            db_pool: Asyncpg database connection pool.
            embedding_generator: Optional embedding generator for vector search.
            openai_client: Optional OpenAI client for GPT-4o re-ranking.
            enable_reranking: Enable hybrid search with GPT-4o re-ranking.
        """
        self.db_pool = db_pool
        self.embedding_generator = embedding_generator
        self.openai_client = openai_client
        self.enable_reranking = enable_reranking and openai_client is not None
        
        # BM25 parameters
        self.k1 = 1.5  # Term frequency saturation
        self.b = 0.75  # Document length normalization
        
        # Cache for document statistics (refreshed on first search)
        self._doc_stats_cache = None
        self._avg_doc_length = None

    async def find_relevant_articles(
        self,
        issue_description: str,
        area: Optional[str] = None,
        limit: int = 5,
        use_hybrid: bool = False
    ) -> List[Tuple[str, str, str]]:
        """Search KB for relevant articles using BM25 ranking.

        Args:
            issue_description: User's issue description to search for.
            area: Optional area to filter results.
            limit: Maximum number of results to return.
            use_hybrid: Use GPT-4o re-ranking if available.

        Returns:
            List of (title, content, area) tuples sorted by relevance.
        """
        search_terms = self._extract_search_terms(issue_description)
        
        if not search_terms:
            return []

        # Expand query with related terms
        expanded_terms = self._expand_query_terms(search_terms)
        
        # Fetch initial candidates with BM25 scoring
        candidates = await self._bm25_search(expanded_terms, area, limit * 3)
        
        # Deduplicate results
        candidates = self._deduplicate_results(candidates)
        
        # Apply GPT-4o re-ranking if enabled
        if use_hybrid and self.enable_reranking and candidates:
            candidates = await self._rerank_with_gpt4o(
                issue_description, candidates, limit
            )
        
        return candidates[:limit]

    def _extract_search_terms(self, text: str) -> List[str]:
        """Extract individual search terms from text with smart preprocessing.

        Args:
            text: Input text to extract terms from.

        Returns:
            List of cleaned, meaningful search terms.
        """
        text = text.lower()
        
        # Handle multi-word phrases first
        phrases = []
        for phrase in RELATED_TERMS.keys():
            if phrase in text:
                phrases.append(phrase)
        
        # Extract words, keeping important n-grams
        words = re.findall(r'\b\w{2,}\b', text)
        
        # Remove stopwords from all languages
        all_stopwords = set()
        for lang_stopwords in STOPWORDS.values():
            all_stopwords.update(lang_stopwords)
        
        filtered_words = [w for w in words if w not in all_stopwords]
        
        # Identify significant n-grams (bigrams that appear together)
        bigrams = []
        for i in range(len(filtered_words) - 1):
            bigram = f"{filtered_words[i]} {filtered_words[i + 1]}"
            # Check if this bigram or its components relate to known terms
            if any(term in bigram for term in phrases):
                bigrams.append(bigram)
        
        # Prioritize: phrases > bigrams > words
        result = list(dict.fromkeys(phrases + bigrams + filtered_words))
        
        # Filter out very short or very common terms
        return [t for t in result if len(t) >= 2]

    def _expand_query_terms(self, terms: List[str]) -> List[str]:
        """Expand query terms with related terms for better recall.

        Args:
            terms: Original search terms.

        Returns:
            Expanded list of search terms including related terms.
        """
        expanded = set(terms)
        
        for term in terms:
            term_lower = term.lower()
            # Direct lookup
            if term_lower in RELATED_TERMS:
                expanded.update(RELATED_TERMS[term_lower])
            # Check for phrase matches
            for phrase, related in RELATED_TERMS.items():
                if term_lower in phrase or phrase in term_lower:
                    expanded.update(related)
        
        return list(expanded)

    def _deduplicate_results(
        self,
        results: List[Tuple[str, str, str, float]]
    ) -> List[Tuple[str, str, str, float]]:
        """Remove duplicate/similar results based on content similarity.

        Args:
            results: List of (title, content, area, score) tuples.

        Returns:
            Deduplicated list of results.
        """
        if not results:
            return results
            
        seen_titles = set()
        seen_content_signatures = set()
        deduplicated = []
        
        for title, content, area, score in results:
            # Create a simple content signature (first 100 chars normalized)
            content_sig = re.sub(r'\s+', '', content[:100].lower())
            
            # Skip if same title or very similar content
            title_normalized = re.sub(r'\s+', '', title.lower())
            if title_normalized in seen_titles:
                continue
            if content_sig in seen_content_signatures:
                continue
                
            seen_titles.add(title_normalized)
            seen_content_signatures.add(content_sig)
            deduplicated.append((title, content, area, score))
        
        return deduplicated

    async def _bm25_search(
        self,
        search_terms: List[str],
        area: Optional[str],
        limit: int
    ) -> List[Tuple[str, str, str, float]]:
        """Search using BM25 ranking algorithm.

        Args:
            search_terms: Expanded search terms.
            area: Optional area filter.
            limit: Maximum results to fetch.

        Returns:
            List of (title, content, area, bm25_score) tuples.
        """
        # Build query for initial candidate fetch
        conditions = []
        params = []
        param_idx = 1

        for term in search_terms[:10]:  # Limit terms for query performance
            conditions.append(
                f"(title ILIKE ${param_idx} OR content ILIKE ${param_idx})"
            )
            params.append(f"%{term}%")
            param_idx += 1

        if area:
            conditions.append(f"area = ${param_idx}")
            params.append(area)
            param_idx += 1

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # Fetch candidates
        query = f"""
            SELECT id, title, content, area,
                   LENGTH(content) as doc_length
            FROM rag.kb_documents
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 3)  # Fetch extra for deduplication

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

        if not rows:
            return []

        # Get document frequency statistics
        await self._ensure_doc_stats()
        
        # Calculate BM25 scores
        scored_results = []
        for row in rows:
            score = self._calculate_bm25_score(
                row['title'], row['content'], search_terms, row['doc_length']
            )
            scored_results.append((
                row['title'], row['content'], row.get('area', ''), score
            ))
        
        # Sort by BM25 score descending
        scored_results.sort(key=lambda x: x[3], reverse=True)
        
        return scored_results

    async def _ensure_doc_stats(self) -> None:
        """Ensure document statistics are cached for BM25 calculation."""
        if self._doc_stats_cache is not None:
            return
            
        query = """
            SELECT COUNT(*) as doc_count, AVG(LENGTH(content)) as avg_length
            FROM rag.kb_documents
        """
        
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query)
        
        self._doc_stats_cache = row['doc_count']
        self._avg_doc_length = row['avg_length'] or 1000

    def _calculate_bm25_score(
        self,
        title: str,
        content: str,
        terms: List[str],
        doc_length: int
    ) -> float:
        """Calculate BM25 score for a document.

        Args:
            title: Document title.
            content: Document content.
            terms: Search terms.
            doc_length: Length of the document.

        Returns:
            BM25 score.
        """
        if not terms or not content:
            return 0.0
            
        N = self._doc_stats_cache or 1
        avgdl = self._avg_doc_length or 1000
        
        title_lower = title.lower()
        content_lower = content.lower()
        full_text = f"{title_lower} {content_lower}"
        
        score = 0.0
        
        for term in terms:
            term_lower = term.lower()
            
            # Term frequency in title (weighted 3x)
            title_tf = title_lower.count(term_lower)
            title_weighted_tf = title_tf * 3
            
            # Term frequency in content
            content_tf = content_lower.count(term_lower)
            
            total_tf = title_weighted_tf + content_tf
            
            if total_tf == 0:
                continue
            
            # Document frequency (approximate using simple counting)
            df = 1  # Assume at least 1 document contains the term
            
            # IDF calculation with smoothing
            idf = math.log((N - df + 0.5) / (df + 0.5) + 1)
            
            # BM25 term component
            tf_component = (total_tf * (self.k1 + 1)) / (
                total_tf + self.k1 * (1 - self.b + self.b * (doc_length / avgdl))
            )
            
            score += idf * tf_component
        
        return score

    async def _rerank_with_gpt4o(
        self,
        issue_description: str,
        candidates: List[Tuple[str, str, str, float]],
        limit: int
    ) -> List[Tuple[str, str, str, float]]:
        """Re-rank candidates using GPT-4o for semantic relevance.

        Args:
            issue_description: Original user issue.
            candidates: BM25-scored candidates.
            limit: Maximum results to return.

        Returns:
            Re-ranked list of results.
        """
        if not candidates or not self.openai_client:
            return candidates
        
        try:
            # Prepare candidates for batch evaluation
            candidate_texts = [
                f"Title: {title}\n\nContent: {content[:500]}..."
                for title, content, area, score in candidates
            ]
            
            # Create reranking prompt
            prompt = f"""Given the user's issue: "{issue_description}"

Evaluate each knowledge base article below for relevance to resolving this issue.
Score each article from 0-10 where:
- 10 = Highly relevant, directly addresses the issue
- 5 = Somewhat relevant, contains related information  
- 0 = Not relevant, doesn't help with this issue

Articles:
{chr(10).join([f"[{i+1}] {text}" for i, text in enumerate(candidate_texts)])}

Return only a JSON array of scores in order, like: [8, 3, 9, 2, 5]
Only return the array, nothing else."""

            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a support ticket analysis assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=100
            )
            
            scores_text = response.choices[0].message.content.strip()
            
            # Parse scores
            import json
            gpt_scores = json.loads(scores_text)
            
            # Combine BM25 and GPT scores (weighted average)
            final_results = []
            for i, (title, content, area, bm25_score) in enumerate(candidates):
                if i < len(gpt_scores):
                    # Normalize GPT score to 0-1 range and combine
                    gpt_normalized = gpt_scores[i] / 10.0
                    # Weight: 40% BM25, 60% GPT relevance
                    combined_score = 0.4 * (bm25_score / 10) + 0.6 * gpt_normalized
                    final_results.append((title, content, area, combined_score))
                else:
                    final_results.append((title, content, area, bm25_score * 0.4))
            
            final_results.sort(key=lambda x: x[3], reverse=True)
            return final_results
            
        except Exception as e:
            # Fallback to BM25 scores if re-ranking fails
            print(f"Re-ranking failed: {e}")
            return candidates

    async def _search_by_embedding(
        self,
        issue_description: str,
        area: Optional[str],
        limit: int
    ) -> List[Tuple[str, str, str]]:
        """Search using vector embeddings (pgvector).

        Args:
            issue_description: Text to embed and search.
            area: Optional area filter.
            limit: Maximum results.

        Returns:
            List of (title, content, area) tuples.
        """
        if not self.embedding_generator:
            return []

        try:
            embedding = self.embedding_generator.generate_embedding(issue_description)
        except Exception:
            return []

        param_idx = 1
        params = [embedding]
        area_condition = ""

        if area:
            area_condition = f" AND area = ${param_idx + 1}"
            params.append(area)

        query = f"""
            SELECT title, content, area,
                   1 - (embedding <=> ${param_idx}) as similarity
            FROM rag.kb_documents
            WHERE embedding IS NOT NULL{area_condition}
            ORDER BY embedding <=> ${param_idx}
            LIMIT ${param_idx + (2 if area else 1)}
        """

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

        return [(row["title"], row["content"], row.get("area", "")) for row in rows]

    def classify_issue_area(self, issue_description: str) -> str:
        """Classify issue into one of the defined areas.

        Args:
            issue_description: User's issue description.

        Returns:
            Area classification string.
        """
        text = issue_description.lower()

        document_keywords = ['document', 'generate', 'transcript', 'prd', 'user story',
                           'meeting notes', 'test case', 'specs', 'specification']
        if any(kw in text for kw in document_keywords):
            return 'document_generation'

        auth_keywords = ['password', 'auth', 'session', 'logout', 'sign in',
                        'sign out', 'credential', '2fa', 'mfa', 'token']
        if any(kw in text for kw in auth_keywords):
            return 'login_auth'

        task_keywords = ['task', 'sprint', 'assign', 'status', 'kanban', 'backlog',
                        'todo', 'in progress', 'done', 'blocked']
        if any(kw in text for kw in task_keywords):
            return 'task_sprint'

        missing_keywords = ['missing', 'not found', 'not showing', '看不到', 'no aparece',
                           'disappeared', 'vanished', 'gone', 'lost', 'empty']
        if any(kw in text for kw in missing_keywords):
            return 'data_missing'

        return 'general'
