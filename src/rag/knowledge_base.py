"""Knowledge base search for RAG-powered support bot."""

from typing import List, Tuple, Optional
import re

from .embeddings import EmbeddingGenerator


class KnowledgeBaseSearcher:
    """Searches knowledge base for relevant articles to support user issues."""

    def __init__(self, db_pool, embedding_generator: EmbeddingGenerator = None):
        """Initialize the knowledge base searcher.

        Args:
            db_pool: Asyncpg database connection pool.
            embedding_generator: Optional embedding generator for vector search.
        """
        self.db_pool = db_pool
        self.embedding_generator = embedding_generator

    async def find_relevant_articles(
        self,
        issue_description: str,
        area: Optional[str] = None,
        limit: int = 3
    ) -> List[Tuple[str, str, str]]:
        """Search KB for relevant articles.

        Uses keyword search (ILIKE) as default.
        Falls back to vector similarity if pgvector is available and embeddings are generated.

        Args:
            issue_description: User's issue description to search for.
            area: Optional area to filter results.
            limit: Maximum number of results to return.

        Returns:
            List of (title, content, area) tuples sorted by relevance.
        """
        search_terms = self._extract_search_terms(issue_description)

        if not search_terms:
            return []

        query = self._build_keyword_search_query(search_terms, area, limit)

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, *search_terms)

        results = [(row["title"], row["content"], row.get("area", "")) for row in rows]

        if len(results) < limit and self.embedding_generator:
            vector_results = await self._search_by_embedding(issue_description, area, limit - len(results))
            results.extend(vector_results)

        return results[:limit]

    def _extract_search_terms(self, text: str) -> List[str]:
        """Extract individual search terms from text.

        Args:
            text: Input text to extract terms from.

        Returns:
            List of cleaned search terms.
        """
        text = text.lower()
        words = re.findall(r'\b\w{2,}\b', text)
        return [w for w in words if w not in {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
            'can', 'had', 'her', 'was', 'one', 'our', 'out', 'what',
            'when', 'where', 'who', 'how', 'this', 'that', 'with',
            'from', 'they', 'have', 'been', 'were', 'being', 'have'
        }]

    def _build_keyword_search_query(
        self,
        search_terms: List[str],
        area: Optional[str],
        limit: int
    ) -> str:
        """Build SQL query for keyword-based search.

        Args:
            search_terms: List of search terms.
            area: Optional area filter.
            limit: Maximum results.

        Returns:
            SQL query string.
        """
        conditions = []
        params = []
        param_idx = 1

        for term in search_terms:
            conditions.append(
                f"(title ILIKE ${param_idx} OR content ILIKE ${param_idx})"
            )
            params.append(f"%{term}%")
            param_idx += 1

        if area:
            conditions.append(f"area = ${param_idx}")
            params.append(area)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        order_clause = ", ".join([
            f"(CASE WHEN title ILIKE ${i} THEN 1 ELSE 0 END + "
            f"CASE WHEN content ILIKE ${i} THEN 1 ELSE 0 END)"
            for i in range(1, len(search_terms) + 1)
        ])

        query = f"""
            SELECT title, content, area,
                   ({order_clause}) as relevance
            FROM rag.kb_documents
            WHERE {where_clause}
            ORDER BY relevance DESC, created_at DESC
            LIMIT ${param_idx}
        """
        params.append(limit)

        return query

    async def _search_by_embedding(
        self,
        issue_description: str,
        area: Optional[str],
        limit: int
    ) -> List[Tuple[str, str, str]]:
        """Search using vector embeddings.

        Args:
            issue_description: Text to embed and search.
            area: Optional area filter.
            limit: Maximum results.

        Returns:
            List of (title, content, area) tuples.
        """
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

        auth_keywords = ['login', 'password', 'auth', 'session', 'logout', 'sign in',
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
