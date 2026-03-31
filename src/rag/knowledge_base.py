"""Knowledge base search para o bot de suporte RAG com ranking BM25Plus e busca híbrida."""

from typing import List, Tuple, Optional
import asyncio
import re

from rank_bm25 import BM25Plus

try:
    import nltk
    from nltk.stem import RSLPStemmer
    _stemmer = RSLPStemmer()
    _nltk_available = True
except Exception:
    _stemmer = None
    _nltk_available = False

from .embeddings import EmbeddingGenerator

# ── Stopwords multilíngues ─────────────────────────────────────────────────────
STOPWORDS = {
    'en': {
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
        'was', 'one', 'our', 'out', 'what', 'when', 'where', 'who', 'how', 'this',
        'that', 'with', 'from', 'they', 'have', 'been', 'were', 'being',
        'has', 'its', 'it', 'just', 'only', 'also', 'very', 'more',
        'most', 'some', 'any', 'each', 'few', 'many', 'much', 'such', 'into',
        'about', 'after', 'before', 'between', 'under', 'again', 'then', 'once',
        'here', 'there', 'why', 'will', 'would', 'could', 'should', 'may', 'might',
        'must', 'shall', 'need', 'like', 'get', 'got', 'getting', 'make', 'made',
    },
    'pt': {
        'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
        'em', 'no', 'na', 'nos', 'nas', 'que', 'e', 'para', 'com', 'por',
        'se', 'mais', 'como', 'mas', 'foi', 'tem', 'isso', 'esta', 'este',
        'ele', 'ela', 'eles', 'elas', 'nao', 'não', 'sim', 'ou', 'ao', 'aos',
        'sua', 'seu', 'seus', 'suas', 'muito', 'já', 'ja', 'so', 'só', 'até',
        'ate', 'bem', 'ser', 'estão', 'estao', 'estamos', 'isso', 'aqui',
        'também', 'tambem', 'quando', 'então', 'entao', 'porque', 'pois',
        'pelo', 'pela', 'pelos', 'pelas', 'num', 'numa', 'nuns', 'numas',
        'me', 'te', 'nos', 'lhe', 'lhes', 'meu', 'minha', 'meus', 'minhas',
        'teu', 'tua', 'teus', 'tuas', 'mim', 'ti', 'si',
    },
    'es': {
        'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'que', 'y',
        'es', 'por', 'con', 'para', 'se', 'como', 'mas', 'fue', 'tiene',
        'esto', 'esta', 'no', 'si', 'o', 'al', 'su', 'muy', 'ya', 'solo',
        'hasta', 'bien', 'ser', 'son', 'estamos',
    },
}

# ── Expansão de termos relacionados ────────────────────────────────────────────
RELATED_TERMS = {
    # Autenticação
    'login': ['signin', 'sign in', 'access', 'password', 'credential', 'authentication', 'auth'],
    'logout': ['sign out', 'signout', 'exit', 'session', 'close'],
    'password': ['senha', 'pwd', 'pass', 'credential', 'auth'],
    'session': ['token', 'jwt', 'cookie', 'expire', 'timeout', 'expired'],
    '2fa': ['two factor', 'mfa', 'totp', 'authenticator', 'verification code'],
    'auth': ['authentication', 'authorize', 'credential', 'login', 'access'],

    # Documentos
    'document': ['doc', 'file', 'pdf', 'report', 'transcript', 'prd', 'spec'],
    'generate': ['create', 'make', 'build', 'produce', 'generate', 'gerar', 'criar'],
    'template': ['modelo', 'pattern', 'boilerplate', 'example', 'sample'],
    'transcript': ['transcricao', 'recording', 'audio', 'minutes', 'notes'],
    'prd': ['product requirements', 'specification', 'spec', 'requirements doc'],
    'user story': ['story', 'requirement', 'feature', 'backlog item'],

    # Tarefas/Sprint
    'task': ['tarefa', 'todo', 'item', 'assignment', 'job'],
    'sprint': ['sprint', 'iteration', 'cycle', 'sprin'],
    'kanban': ['board', 'column', 'lane', 'workflow', 'status'],
    'backlog': ['queue', 'pending', 'todo list', 'sprint backlog'],
    'status': ['state', 'condition', 'progress', 'estado', 'situacao'],
    'assign': ['allocate', 'delegate', 'set', 'asignar', 'atribuir'],
    'blocked': ['blocked', 'stuck', 'waiting', 'impeded', 'obstacle'],

    # Dados
    'missing': ['not found', 'lost', 'vanished', 'gone', 'empty', 'null', 'none'],
    'not found': ['missing', '404', 'error', 'doesnt exist', 'no existe'],
    'error': ['bug', 'issue', 'problem', 'falha', 'erro', 'fail'],
    'data': ['information', 'content', 'record', 'entry', 'dados'],

    # Interface
    'display': ['show', 'display', 'view', 'render', 'exibir', 'mostrar'],
    'button': ['click', 'press', 'action', 'botao', 'click'],
    'screen': ['page', 'view', 'interface', 'tela', 'pantalla'],
    'loading': ['carregando', 'loading', 'wait', 'spinner', 'processing'],

    # Geral
    'user': ['usuario', 'user', 'member', 'participant', 'client'],
    'project': ['workspace', 'team', 'organization', 'projeto', 'projecto'],
    'help': ['support', 'assist', 'aid', 'guia', 'ayuda', 'support'],
    'issue': ['problem', 'bug', 'error', 'difficulty', 'problema'],
    'impossible': ['cannot', 'cant', 'unable', 'failing', 'nao pode', 'no puede'],
}


def _stem_token(token: str) -> str:
    """Aplica RSLPStemmer ao token; retorna o próprio token se NLTK não estiver disponível."""
    if _stemmer is not None:
        try:
            return _stemmer.stem(token)
        except Exception:
            pass
    return token


def _tokenize(text: str) -> List[str]:
    """Tokeniza e aplica stemming português ao texto, removendo stopwords."""
    text = text.lower()
    words = re.findall(r'\b\w{2,}\b', text)

    all_stopwords: set = set()
    for lang_sw in STOPWORDS.values():
        all_stopwords.update(lang_sw)

    stemmed = []
    for word in words:
        if word not in all_stopwords:
            stemmed.append(_stem_token(word))

    return stemmed


# ── SQL para migração do tsvector/GIN ─────────────────────────────────────────
_TSVECTOR_MIGRATION_SQL = """
-- Adiciona coluna search_vector se não existir
ALTER TABLE rag.kb_documents
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Popula coluna com conteúdo existente
UPDATE rag.kb_documents
SET search_vector = to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(content, ''))
WHERE search_vector IS NULL;

-- Cria índice GIN se não existir
CREATE INDEX IF NOT EXISTS kb_documents_search_vector_idx
    ON rag.kb_documents USING GIN (search_vector);

-- Cria trigger para manter search_vector atualizado
CREATE OR REPLACE FUNCTION rag.kb_documents_tsv_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        to_tsvector('portuguese', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_documents_tsv_update ON rag.kb_documents;

CREATE TRIGGER kb_documents_tsv_update
BEFORE INSERT OR UPDATE ON rag.kb_documents
FOR EACH ROW EXECUTE FUNCTION rag.kb_documents_tsv_trigger();
"""


class KnowledgeBaseSearcher:
    """Busca na base de conhecimento com BM25Plus, stemming pt-BR e pré-filtro tsvector.

    Funcionalidades:
    - Tokenização com RSLPStemmer (pt-BR)
    - BM25Plus (rank_bm25) com IDF correto substituindo o cálculo manual
    - Expansão de termos relacionados para maior recall
    - Pré-filtro PostgreSQL com tsvector/GIN + plainto_tsquery
    - Re-ranking híbrido com GPT-4o (opcional, async-safe)
    - Desduplicação de resultados
    """

    # Parâmetros BM25Plus
    _BM25_K1 = 1.2
    _BM25_B = 0.75
    _BM25_DELTA = 1.0

    def __init__(
        self,
        db_pool,
        embedding_generator: EmbeddingGenerator = None,
        openai_client=None,
        enable_reranking: bool = False,
    ):
        """Inicializa o buscador de base de conhecimento.

        Args:
            db_pool: Pool de conexão asyncpg.
            embedding_generator: Gerador de embeddings para busca vetorial (opcional).
            openai_client: Cliente OpenAI para re-ranking com GPT-4o (opcional).
            enable_reranking: Habilita re-ranking híbrido com GPT-4o.
        """
        self.db_pool = db_pool
        self.embedding_generator = embedding_generator
        self.openai_client = openai_client
        self.enable_reranking = enable_reranking and openai_client is not None

    async def ensure_tsvector_setup(self) -> None:
        """Garante que a coluna tsvector e o índice GIN existam no banco.

        Executa a migração idempotente de forma segura (IF NOT EXISTS).
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(_TSVECTOR_MIGRATION_SQL)

    async def find_relevant_articles(
        self,
        issue_description: str,
        area: Optional[str] = None,
        limit: int = 5,
        use_hybrid: bool = False,
    ) -> List[Tuple[str, str, str]]:
        """Busca artigos relevantes na KB usando BM25Plus com stemming pt-BR.

        Args:
            issue_description: Descrição do problema reportado pelo usuário.
            area: Área para filtrar resultados (opcional).
            limit: Número máximo de resultados.
            use_hybrid: Usa re-ranking com GPT-4o se disponível.

        Returns:
            Lista de tuplas (título, conteúdo, área) ordenadas por relevância.
        """
        search_terms = self._extract_search_terms(issue_description)

        if not search_terms:
            return []

        expanded_terms = self._expand_query_terms(search_terms)

        candidates = await self._bm25_search(expanded_terms, issue_description, area, limit * 3)

        candidates = self._deduplicate_results(candidates)

        if use_hybrid and self.enable_reranking and candidates:
            candidates = await self._rerank_with_gpt4o(issue_description, candidates, limit)

        return [(title, content, area_val) for title, content, area_val, _ in candidates[:limit]]

    def _extract_search_terms(self, text: str) -> List[str]:
        """Extrai termos de busca aplicando stemming e remoção de stopwords.

        Args:
            text: Texto de entrada.

        Returns:
            Lista de termos limpos e com stemming aplicado.
        """
        text_lower = text.lower()

        # Detecta frases conhecidas antes de tokenizar
        phrases = [phrase for phrase in RELATED_TERMS if phrase in text_lower]

        # Tokenização com stemming
        stemmed_words = _tokenize(text_lower)

        # Bigrams a partir das palavras com stemming
        bigrams = []
        for i in range(len(stemmed_words) - 1):
            bigram = f"{stemmed_words[i]} {stemmed_words[i + 1]}"
            if any(phrase in bigram for phrase in phrases):
                bigrams.append(bigram)

        result = list(dict.fromkeys(phrases + bigrams + stemmed_words))
        return [t for t in result if len(t) >= 2]

    def _expand_query_terms(self, terms: List[str]) -> List[str]:
        """Expande termos de busca com termos relacionados para maior recall.

        Args:
            terms: Termos de busca originais.

        Returns:
            Lista expandida incluindo termos relacionados.
        """
        expanded: set = set(terms)

        for term in terms:
            term_lower = term.lower()
            if term_lower in RELATED_TERMS:
                expanded.update(RELATED_TERMS[term_lower])
            for phrase, related in RELATED_TERMS.items():
                if term_lower in phrase or phrase in term_lower:
                    expanded.update(related)

        return list(expanded)

    def _deduplicate_results(
        self,
        results: List[Tuple[str, str, str, float]],
    ) -> List[Tuple[str, str, str, float]]:
        """Remove resultados duplicados ou muito similares.

        Args:
            results: Lista de tuplas (título, conteúdo, área, score).

        Returns:
            Lista desduplicada.
        """
        if not results:
            return results

        seen_titles: set = set()
        seen_sigs: set = set()
        deduped = []

        for title, content, area, score in results:
            sig = re.sub(r'\s+', '', content[:100].lower())
            title_norm = re.sub(r'\s+', '', title.lower())

            if title_norm in seen_titles or sig in seen_sigs:
                continue

            seen_titles.add(title_norm)
            seen_sigs.add(sig)
            deduped.append((title, content, area, score))

        return deduped

    async def _bm25_search(
        self,
        search_terms: List[str],
        raw_query: str,
        area: Optional[str],
        limit: int,
    ) -> List[Tuple[str, str, str, float]]:
        """Busca candidatos usando pré-filtro tsvector/GIN + ranking BM25Plus.

        Args:
            search_terms: Termos de busca expandidos.
            raw_query: Query original do usuário para pré-filtro tsvector.
            area: Filtro por área (opcional).
            limit: Número máximo de candidatos.

        Returns:
            Lista de tuplas (título, conteúdo, área, score_bm25plus) ordenada.
        """
        params: list = []
        param_idx = 1
        conditions: List[str] = []

        # Pré-filtro tsvector/GIN (SRCH-03)
        # Tenta usar plainto_tsquery; faz fallback para ILIKE se a coluna não existir
        tsquery_condition = (
            f"(search_vector @@ plainto_tsquery('portuguese', ${param_idx})"
            f" OR search_vector IS NULL)"
        )
        conditions.append(tsquery_condition)
        params.append(raw_query)
        param_idx += 1

        # Filtro ILIKE como complemento para garantir recall
        ilike_parts = []
        for term in search_terms[:10]:
            ilike_parts.append(
                f"(title ILIKE ${param_idx} OR content ILIKE ${param_idx})"
            )
            params.append(f"%{term}%")
            param_idx += 1

        if ilike_parts:
            conditions.append(f"({' OR '.join(ilike_parts)})")

        if area:
            conditions.append(f"area = ${param_idx}")
            params.append(area)
            param_idx += 1

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        query = f"""
            SELECT id, title, content, area,
                   LENGTH(content) AS doc_length
            FROM rag.kb_documents
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 3)

        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
        except Exception:
            # Fallback sem tsvector caso a coluna ainda não exista
            rows = await self._fetch_ilike_only(search_terms, area, limit)

        if not rows:
            return []

        return self._score_with_bm25plus(rows, search_terms)

    async def _fetch_ilike_only(
        self,
        search_terms: List[str],
        area: Optional[str],
        limit: int,
    ) -> list:
        """Busca de fallback usando apenas ILIKE sem tsvector."""
        params: list = []
        param_idx = 1
        ilike_parts: List[str] = []

        for term in search_terms[:10]:
            ilike_parts.append(
                f"(title ILIKE ${param_idx} OR content ILIKE ${param_idx})"
            )
            params.append(f"%{term}%")
            param_idx += 1

        if not ilike_parts:
            return []

        where_clause = " OR ".join(ilike_parts)

        if area:
            where_clause = f"({where_clause}) AND area = ${param_idx}"
            params.append(area)
            param_idx += 1

        query = f"""
            SELECT id, title, content, area,
                   LENGTH(content) AS doc_length
            FROM rag.kb_documents
            WHERE {where_clause}
            LIMIT ${param_idx}
        """
        params.append(limit * 3)

        async with self.db_pool.acquire() as conn:
            return await conn.fetch(query, *params)

    def _score_with_bm25plus(
        self,
        rows: list,
        search_terms: List[str],
    ) -> List[Tuple[str, str, str, float]]:
        """Aplica BM25Plus sobre os candidatos pré-filtrados.

        Constrói um corpus tokenizado com stemming e utiliza BM25Plus da
        biblioteca rank_bm25 com parâmetros k1=1.2, b=0.75, delta=1.0.

        Args:
            rows: Linhas do banco retornadas pela query.
            search_terms: Termos de busca (já com stemming).

        Returns:
            Lista de tuplas (título, conteúdo, área, score) ordenada.
        """
        # Constrói corpus tokenizado — título recebe peso extra (repetido 3x)
        corpus_tokens: List[List[str]] = []
        for row in rows:
            title_tokens = _tokenize(row['title']) * 3
            content_tokens = _tokenize(row['content'])
            corpus_tokens.append(title_tokens + content_tokens)

        # Índice BM25Plus (corrige IDF hardcoded df=1 do cálculo manual)
        bm25 = BM25Plus(
            corpus_tokens,
            k1=self._BM25_K1,
            b=self._BM25_B,
            delta=self._BM25_DELTA,
        )

        # Query com stemming aplicado
        query_tokens = _tokenize(' '.join(search_terms))
        scores = bm25.get_scores(query_tokens)

        scored: List[Tuple[str, str, str, float]] = []
        for idx, row in enumerate(rows):
            scored.append((
                row['title'],
                row['content'],
                row.get('area', ''),
                float(scores[idx]),
            ))

        scored.sort(key=lambda x: x[3], reverse=True)
        return scored

    async def _rerank_with_gpt4o(
        self,
        issue_description: str,
        candidates: List[Tuple[str, str, str, float]],
        limit: int,
    ) -> List[Tuple[str, str, str, float]]:
        """Re-ranqueia candidatos com GPT-4o de forma async-safe.

        Args:
            issue_description: Descrição original do problema.
            candidates: Candidatos com score BM25Plus.
            limit: Número máximo de resultados.

        Returns:
            Lista re-ranqueada.
        """
        if not candidates or not self.openai_client:
            return candidates

        try:
            candidate_texts = [
                f"Título: {title}\n\nConteúdo: {content[:500]}..."
                for title, content, area, score in candidates
            ]

            prompt = f"""Problema relatado pelo usuário: "{issue_description}"

Avalie cada artigo da base de conhecimento abaixo quanto à relevância para resolver este problema.
Atribua uma pontuação de 0 a 10 para cada artigo, onde:
- 10 = Altamente relevante, aborda diretamente o problema
- 5 = Parcialmente relevante, contém informações relacionadas
- 0 = Irrelevante, não auxilia na resolução do problema

Artigos:
{chr(10).join([f"[{i + 1}] {text}" for i, text in enumerate(candidate_texts)])}

Retorne apenas um array JSON com as pontuações em ordem, como: [8, 3, 9, 2, 5]
Retorne apenas o array, sem mais nada."""

            # Chamada async-safe: executa em thread pool para não bloquear o event loop
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": "Você é um assistente de análise de chamados de suporte.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=100,
                ),
            )

            import json

            scores_text = response.choices[0].message.content.strip()
            gpt_scores = json.loads(scores_text)

            final: List[Tuple[str, str, str, float]] = []
            for i, (title, content, area, bm25_score) in enumerate(candidates):
                if i < len(gpt_scores):
                    gpt_norm = gpt_scores[i] / 10.0
                    combined = 0.4 * (bm25_score / 10.0) + 0.6 * gpt_norm
                    final.append((title, content, area, combined))
                else:
                    final.append((title, content, area, bm25_score * 0.4))

            final.sort(key=lambda x: x[3], reverse=True)
            return final

        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Re-ranking falhou: %s", exc)
            return candidates

    async def _search_by_embedding(
        self,
        issue_description: str,
        area: Optional[str],
        limit: int,
    ) -> List[Tuple[str, str, str]]:
        """Busca por similaridade vetorial usando pgvector.

        Args:
            issue_description: Texto para gerar embedding.
            area: Filtro por área (opcional).
            limit: Número máximo de resultados.

        Returns:
            Lista de tuplas (título, conteúdo, área).
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
                   1 - (embedding <=> ${param_idx}) AS similarity
            FROM rag.kb_documents
            WHERE embedding IS NOT NULL{area_condition}
            ORDER BY embedding <=> ${param_idx}
            LIMIT ${param_idx + (2 if area else 1)}
        """

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

        return [(row["title"], row["content"], row.get("area", "")) for row in rows]

    def classify_issue_area(self, issue_description: str) -> str:
        """Classifica o problema em uma das áreas definidas.

        Args:
            issue_description: Descrição do problema do usuário.

        Returns:
            Classificação de área como string.
        """
        text = issue_description.lower()

        document_keywords = [
            'document', 'generate', 'transcript', 'prd', 'user story',
            'meeting notes', 'test case', 'specs', 'specification',
        ]
        if any(kw in text for kw in document_keywords):
            return 'document_generation'

        auth_keywords = [
            'password', 'auth', 'session', 'logout', 'sign in',
            'sign out', 'credential', '2fa', 'mfa', 'token',
        ]
        if any(kw in text for kw in auth_keywords):
            return 'login_auth'

        task_keywords = [
            'task', 'sprint', 'assign', 'status', 'kanban', 'backlog',
            'todo', 'in progress', 'done', 'blocked',
        ]
        if any(kw in text for kw in task_keywords):
            return 'task_sprint'

        missing_keywords = [
            'missing', 'not found', 'not showing', 'no aparece',
            'disappeared', 'vanished', 'gone', 'lost', 'empty',
        ]
        if any(kw in text for kw in missing_keywords):
            return 'data_missing'

        return 'general'
