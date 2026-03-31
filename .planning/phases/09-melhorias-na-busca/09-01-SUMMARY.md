# Fase 09 — Plano 01: Sumário de Execução

Criado em: 2026-03-30
Última atualização: 2026-03-30

## Status: COMPLETO

## O que foi feito

### SRCH-01 — Stemming pt-BR com RSLPStemmer

- Importado `nltk.stem.RSLPStemmer` com fallback gracioso caso o NLTK não esteja disponível.
- Criada função auxiliar `_stem_token(token)` e `_tokenize(text)` que combinam: lowercase, regex tokenização, remoção de stopwords multilíngues e stemming.
- Stopwords portuguesas ampliadas com formas acentuadas (não, já, só, até, também, então, etc.).
- Stemming aplicado tanto na indexação do corpus (em `_score_with_bm25plus`) quanto na tokenização da query.

### SRCH-02 — BM25Plus substituindo cálculo manual

- Removido o método `_calculate_bm25_score` (que hardcodava `df=1` na IDF).
- Adicionado `_score_with_bm25plus(rows, search_terms)` que:
  - Constrói corpus tokenizado via `_tokenize` (com stemming).
  - Aplica peso 3x para tokens do título (repetição no corpus).
  - Instancia `BM25Plus(corpus, k1=1.2, b=0.75, delta=1.0)` da biblioteca `rank_bm25`.
  - Calcula e retorna scores com IDF correto baseado na distribuição real dos termos.
- Removidos atributos desnecessários `_doc_stats_cache` e `_avg_doc_length`.

### SRCH-03 — Coluna tsvector + índice GIN

- Adicionada constante `_TSVECTOR_MIGRATION_SQL` com DDL idempotente:
  - `ADD COLUMN IF NOT EXISTS search_vector tsvector`
  - `UPDATE ... SET search_vector = to_tsvector('portuguese', title || content) WHERE search_vector IS NULL`
  - `CREATE INDEX IF NOT EXISTS ... USING GIN (search_vector)`
  - Trigger `kb_documents_tsv_update` para manter a coluna sincronizada em INSERT/UPDATE
- Método público `ensure_tsvector_setup()` expõe a migração para ser chamada durante inicialização da aplicação.
- `_bm25_search` usa pré-filtro `search_vector @@ plainto_tsquery('portuguese', $1)` antes do ILIKE.
- Fallback automático para ILIKE-only (`_fetch_ilike_only`) caso a coluna não exista.

### Async-safety do re-ranking

- `_rerank_with_gpt4o` agora usa `await loop.run_in_executor(None, lambda: ...)` para envolver a chamada síncrona `openai_client.chat.completions.create(...)`.
- Nenhum bloqueio do event loop durante o re-ranking.

## Testes

- 22 testes passando em `tests/test_knowledge_base.py`.
- `TestBM25Scoring` renomeado para `TestBM25PlusScoring` com testes reescritos para usar `_score_with_bm25plus`.
- Dois testes ajustados para refletir comportamento correto (stopwords e prioridade de classificação).

## Verificação

```
python3 -c "from src.rag.knowledge_base import KnowledgeBaseSearcher; print('Import OK')"
# Import OK
```
