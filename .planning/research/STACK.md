# Stack Research — RAG Workforce Bot v2

**Created:** 2026-03-30
**Last updated:** 2026-03-30
**Scope:** Menu navigation, pt-br localization, search quality improvements on top of existing Python + python-telegram-bot 21.7 stack.

---

## Recommended Stack

| Layer | Package | Version | Rationale |
|---|---|---|---|
| Bot framework | python-telegram-bot | 21.7 (keep) | Stable, full-featured, no breaking changes needed |
| State persistence | PicklePersistence (PTB built-in) | — | Zero deps, sufficient for single-process deploy; drop-in upgrade to PostgreSQL-backed custom Persistence later |
| i18n | gettext + python-gettext (stdlib) | stdlib 3.11 | Industry standard, PO/MO file tooling, Poedit-compatible |
| BM25 | rank-bm25 | 0.2.2 (keep) | Upgrade to BM25Plus variant via same package; no new dep |
| Semantic re-ranking | sentence-transformers (optional) | 3.x | Local model, zero API cost, pgvector already in stack |
| Tokenization (pt-br) | nltk | 3.9.x (keep) | RSLPStemmer + stopwords for Portuguese built-in |

No new runtime dependencies are strictly required. The most impactful changes are architectural (how PTB handlers are wired) and algorithmic (which BM25 variant and tokenization pipeline).

---

## Menu Navigation Patterns

### Decision: Callback-based navigation with ConversationHandler for guided flows

The bot already uses a manual state machine (`ConversationState` enum in `conversation_manager.py`). The v2 menu layer should use **ConversationHandler** for the guided report/question flows and **plain CallbackQueryHandler with regex patterns** for stateless menus (main menu, back navigation, category selection).

#### Why not pure callback-based for everything

A single monolithic `CallbackQueryHandler` (as currently in `button_callback`) becomes an unbounded `if/elif` chain once menus have 3+ levels. Pattern-matched handlers registered separately are cleaner but still suffer from global scope pollution at scale.

#### Why not ConversationHandler for everything

ConversationHandler is excellent for linear multi-step flows (report error wizard, feedback collection). It is awkward for free-roam menus where the user can jump between levels because `states` must be exhaustive and each state must explicitly declare which `CallbackQueryHandler` patterns it accepts.

#### Recommended hybrid

```
/start  ──► ConversationHandler (MENU_ROOT entry point)
              STATE: MAIN_MENU
                ├─ "tirar_duvidas"  → STATE: FAQ_CATEGORY
                │     └─ "categoria:X" → STATE: FAQ_RESULT (shows KB hits)
                ├─ "reportar_erro"  → STATE: REPORT_COLLECT (guided wizard)
                │     └─ text answers → ... → ConversationHandler.END
                └─ "voltar"         → back to previous state
```

Each state holds a list of `CallbackQueryHandler(handler_fn, pattern="^state:value$")` entries. The back button emits a callback like `"nav:back"` and the handler pops from a stack stored in `context.user_data["nav_stack"]`.

**Concrete implementation notes:**

- Keep `ConversationState` enum but rename/extend it to align with menu levels (`MAIN_MENU`, `FAQ_CATEGORY`, `FAQ_RESULT`, `REPORT_COLLECT`, `REPORT_CONFIRM`, `ESCALATED`).
- Move conversation state out of the in-memory `ConversationManager` dict into `context.user_data` so PTB's built-in persistence can serialize it across restarts.
- Register the entire menu flow as a single `ConversationHandler` with `persistent=True, name="support_flow"` backed by `PicklePersistence`.
- Use `query.edit_message_text(text=..., reply_markup=...)` to replace the menu in-place rather than sending new messages — this keeps the chat clean.

**Back button pattern:**

```python
BACK_BUTTON = InlineKeyboardButton("« Voltar", callback_data="nav:back")

# In each handler:
nav_stack = context.user_data.setdefault("nav_stack", [])
nav_stack.append(current_state)  # push before transitioning
return NEXT_STATE

# Back handler:
async def handle_back(update, context):
    nav_stack = context.user_data.get("nav_stack", [])
    previous_state = nav_stack.pop() if nav_stack else MAIN_MENU
    await render_state(update, context, previous_state)
    return previous_state
```

#### Pattern matching strategy

Use hierarchical prefixes in `callback_data` to allow single-regex routing:

```
"nav:back"
"menu:main"
"faq:categoria:login_auth"
"faq:categoria:task_sprint"
"report:start"
"report:step:1"
"confirm:yes"
"confirm:no"
```

Register handlers with `pattern="^faq:"`, `pattern="^report:"` etc. This keeps each module's handlers isolated.

#### What NOT to do for menus

- Do not use `ReplyKeyboardMarkup` for multi-level navigation — it clutters the keyboard area and cannot be dismissed per-screen.
- Do not encode menu state in `callback_data` alone (e.g., serialize entire state as JSON into the button) — Telegram limits `callback_data` to 64 bytes.
- Do not build a single `button_callback` god-handler that if/elifs over all possible values — it will grow past 300 lines.
- Do not rely on `message.reply_text` to show each menu level — always `edit_message_text` to avoid flooding the chat.

---

## Localization Approach

### Decision: gettext with `.po` files, single `pt_BR` locale, no third-party i18n library

#### Why gettext over dict-based strings (current approach)

The current codebase uses `BOT_MESSAGES` dict in `templates.py`. This works but does not scale when:
- The same string appears in multiple templates with slight variation.
- Plurals are needed (e.g., "1 resultado" vs "3 resultados").
- Translators (non-developers) need to maintain strings.

`gettext` uses PO files editable with Poedit, handles plural forms natively, and is stdlib — no new dependency.

#### Why not fluent-python

[Project Fluent](https://projectfluent.org/) is excellent for complex grammatical constructs but adds a non-trivial dependency and learning curve. The bot's messages are short, imperative support bot text — overkill.

#### Why not a translation library like Babel or deep-translator

Babel provides locale data and formatting (dates, numbers), not string translation management. It is worth adding later for date formatting (`created_at` timestamps), but is not the core i18n solution.

#### Implementation

```
src/
  locales/
    pt_BR/
      LC_MESSAGES/
        bot.po
        bot.mo   ← compiled, in .gitignore
  utils/
    i18n.py      ← thin wrapper
```

```python
# src/utils/i18n.py
import gettext
import os

_LOCALE_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")

def get_translator(lang: str = "pt_BR"):
    try:
        t = gettext.translation("bot", localedir=_LOCALE_DIR, languages=[lang])
    except FileNotFoundError:
        t = gettext.NullTranslations()
    return t.gettext

_ = get_translator()
```

Usage in handlers: `await update.message.reply_text(_("Bem-vindo ao suporte Workforce!"))`.

All bot-facing strings in `templates.py` and `handlers.py` become `_("original string")` calls. The `.po` file maps them to pt-BR equivalents.

Compile MO files in the Docker build step:

```dockerfile
RUN msgfmt src/locales/pt_BR/LC_MESSAGES/bot.po -o src/locales/pt_BR/LC_MESSAGES/bot.mo
```

#### LLM prompt localization

System prompts and few-shot examples inside `IssueClassifier` and `QuestionGenerator` should be rewritten in pt-BR directly — not translated at runtime. The LLM (MiniMax-M2) performs better when the prompt language matches the expected output language. Mark these strings with a comment `# LLM_PROMPT` and keep them as plain string constants, not gettext-managed (they are not user-facing UI text).

---

## Search Improvements

### Current state assessment

The existing `KnowledgeBaseSearcher._bm25_search` implements BM25 manually in Python against raw SQL candidates fetched by `ILIKE`. This has two weaknesses:

1. **Recall ceiling**: `ILIKE %term%` fetches candidates but misses documents where neither the exact term nor its substring appears — stemming variants go undetected.
2. **IDF approximation**: `df = 1` hardcoded in `_calculate_bm25_score` means IDF is always `log((N + 0.5) / 1.5)`, rendering it constant per corpus. Rare terms get the same IDF as common terms, which defeats the BM25 discriminative power.

### Recommended improvements

#### 1. Switch to rank-bm25's BM25Plus variant (no new dep)

Replace the hand-rolled BM25 with `rank_bm25.BM25Plus`. BM25Plus adds a floor parameter `delta` that prevents longer documents from being unfairly penalized:

```python
from rank_bm25 import BM25Plus
import nltk
from nltk.stem import RSLPStemmer
from nltk.corpus import stopwords

stemmer = RSLPStemmer()
pt_stopwords = set(stopwords.words("portuguese"))

def tokenize_pt(text: str) -> list[str]:
    tokens = nltk.word_tokenize(text.lower(), language="portuguese")
    return [
        stemmer.stem(t) for t in tokens
        if t.isalnum() and t not in pt_stopwords and len(t) > 2
    ]

# Build index at startup / cache invalidation
tokenized_corpus = [tokenize_pt(doc.title + " " + doc.content) for doc in kb_docs]
bm25 = BM25Plus(tokenized_corpus, k1=1.2, b=0.75, delta=1.0)
```

Tuning guidance:
- `k1=1.2`: lower saturation (vs default 1.5) suits short KB articles where term frequency rarely exceeds 3–5 per field.
- `b=0.75`: standard length normalization — keep unless document lengths vary wildly.
- `delta=1.0`: BM25Plus baseline; ensures every matched term contributes positively.

NLTK's `RSLPStemmer` is the standard stemmer for Brazilian Portuguese. It is already a project dependency.

#### 2. Fix the BM25 cache invalidation gap

The current `_doc_stats_cache` never expires. Add a TTL or a version counter tied to KB document inserts:

```python
# On KB document insert/update:
await conn.execute("SELECT pg_notify('kb_updated', '')")

# In KnowledgeBaseSearcher, listen on startup:
await conn.add_listener("kb_updated", self._invalidate_cache)
```

Alternatively, rebuild the BM25 index nightly via a scheduled job if real-time consistency is not required.

#### 3. Semantic re-ranking with sentence-transformers (optional, zero API cost)

The current GPT-4o re-ranking in `_rerank_with_gpt4o` works but costs API tokens on every search. A local cross-encoder is faster and free at inference time:

```
sentence-transformers==3.4.x
```

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
# Portuguese-specific: "rufimelo/Legal-BERTimbau-sts-large" for domain-tuned PT

pairs = [(query, doc_content) for _, doc_content, _, _ in bm25_candidates]
scores = reranker.predict(pairs)
reranked = sorted(zip(bm25_candidates, scores), key=lambda x: x[1], reverse=True)
```

Use `cross-encoder/ms-marco-MiniLM-L-6-v2` for multilingual coverage (handles pt-BR adequately). For production with pt-BR-heavy KB content, `neuralmind/bert-base-portuguese-cased` fine-tuned as a cross-encoder is a stronger choice but requires fine-tuning.

This replaces `_rerank_with_gpt4o` and removes the `gpt-4o` call from the search path.

#### 4. PostgreSQL full-text search as pre-filter (reduces ILIKE overhead)

Replace `ILIKE %term%` candidate fetch with a tsvector pre-filter using the `portuguese` dictionary:

```sql
-- Add column on migration:
ALTER TABLE rag.kb_documents
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,''))
  ) STORED;

CREATE INDEX idx_kb_fts ON rag.kb_documents USING GIN(fts);

-- Query:
SELECT id, title, content, area, LENGTH(content) as doc_length
FROM rag.kb_documents
WHERE fts @@ plainto_tsquery('portuguese', $1)
ORDER BY ts_rank(fts, plainto_tsquery('portuguese', $1)) DESC
LIMIT $2
```

This gives PostgreSQL-level stemming and ranking as a recall gate, then Python-level BM25Plus re-scores the shortlist. The `ILIKE` path can be retained as a fallback for zero-result queries.

#### 5. Query expansion: keep current approach but tighten pt-BR terms

`RELATED_TERMS` in `knowledge_base.py` is heavily English-biased. Extend with pt-BR equivalents inline rather than maintaining two dicts. Remove the Chinese characters (`看不到`) that suggest copy-paste contamination.

---

## What NOT to Use

| Candidate | Verdict | Reason |
|---|---|---|
| `aiogram` | No | Would require full rewrite; breaks all existing handlers |
| `telebot` (pyTelegramBotAPI) | No | Less mature async support; does not add value over PTB |
| `ConversationHandler` for the entire bot | No | Cannot handle non-linear navigation (jumping to FAQ mid-report) cleanly; combine with plain CBQ handlers |
| `ReplyKeyboardMarkup` for menus | No | Persistent keyboard clutters mobile UI; cannot be scoped per-screen |
| `fluent-python` for i18n | No | Overkill for a 50-string single-language bot; adds an uncommon dependency |
| `Babel` as primary i18n | No | Babel is a locale data library, not a string translation system; use gettext instead |
| GPT-4o re-ranking in search hot path | No | Adds 1–3 s latency and token cost per query; replace with local cross-encoder |
| `elasticsearch` / `opensearch` | No | Disproportionate infrastructure overhead for a <10k document KB; pgvector + PostgreSQL FTS is sufficient |
| Encoding menu state in `callback_data` JSON | No | Telegram enforces 64-byte limit on callback_data; use `context.user_data` for state |
| Single god-handler `button_callback` | No | Already at risk in current code; will become unmaintainable past 5 menu states |
| Switching BM25 to ElasticSearch BM25 | No | Infra overhead unjustified; `rank_bm25.BM25Plus` achieves the same tuning within existing stack |
| `bm25s` library as replacement | Conditional | BM25S is faster for large corpora (>100k docs) via sparse matrices; not necessary at current KB scale, revisit if KB grows past 50k documents |
