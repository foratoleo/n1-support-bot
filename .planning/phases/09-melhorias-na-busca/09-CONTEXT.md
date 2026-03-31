# Fase 09 — Melhorias na Busca: Contexto

Criado em: 2026-03-30
Última atualização: 2026-03-30

## Objetivo

Corrigir os bugs conhecidos na pipeline de busca e elevar a precisão com:
- Stemming pt-BR via RSLPStemmer (NLTK)
- BM25Plus substituindo o cálculo manual com df=1 hardcoded
- Índice FTS (tsvector/GIN) no PostgreSQL como pré-filtro
- Correção de async-safety no re-ranking com GPT-4o

## Requisitos Cobertos

| ID      | Descrição                                            |
|---------|------------------------------------------------------|
| SRCH-01 | RSLPStemmer aplicado na tokenização de queries e docs |
| SRCH-02 | BM25Plus substitui cálculo manual (df=1 hardcoded)   |
| SRCH-03 | Coluna tsvector + índice GIN + dicionário portuguese  |

## Arquivos Principais

- `src/rag/knowledge_base.py` — implementação da busca (arquivo central desta fase)
- `tests/test_knowledge_base.py` — testes atualizados para BM25Plus

## Decisões de Design

1. **RSLPStemmer opcional**: o stemmer é instanciado no módulo com tratamento de exceção; se o NLTK não estiver disponível, a busca continua funcional sem stemming.

2. **BM25Plus com rank_bm25**: substituiu completamente o método `_calculate_bm25_score` manual. O índice é construído por chamada de `_score_with_bm25plus` a partir dos candidatos pré-filtrados. Parâmetros: k1=1.2, b=0.75, delta=1.0.

3. **tsvector/GIN**: a migração é idempotente (`IF NOT EXISTS`, `IF NULL`). Um trigger mantém a coluna sincronizada em INSERT/UPDATE. Fallback para ILIKE-only caso a coluna ainda não exista no banco.

4. **Async-safe reranking**: `_rerank_with_gpt4o` usa `asyncio.get_event_loop().run_in_executor(None, lambda: ...)` para envolver a chamada síncrona da SDK OpenAI, evitando bloqueio do event loop.
