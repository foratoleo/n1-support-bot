# Research Summary — RAG Workforce Bot v2

**Created:** 2026-03-30
**Last updated:** 2026-03-30
**Source documents:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Key Findings

The v2 milestone is achievable without introducing new runtime dependencies. The four major work areas — menu navigation, pt-br localization, search quality, and code structure — are all solvable within the existing python-telegram-bot 21.7 + PostgreSQL + rank-bm25 + nltk stack.

The single most important architectural insight is that the current codebase has two compounding structural debts that must be paid before adding any menu logic: (1) the monolithic `button_callback` god-handler that does not scale past 3 menu states, and (2) the monolithic `handle_message()` function that mixes dispatch, DB access, and business logic. Both must be refactored incrementally before menu features are layered on.

The search pipeline has two concrete bugs — a hardcoded IDF approximation (`df = 1`) that nullifies BM25 discriminative power, and a synchronous API call inside an async event loop in `_rerank_with_gpt4o` — both fixable with targeted edits and no new dependencies.

---

## Recommended Stack Changes

### Keep as-is

| Component | Reason |
|-----------|--------|
| python-telegram-bot 21.7 | Stable, full-featured; no breaking changes needed |
| rank-bm25 0.2.2 | Upgrade to BM25Plus variant within the same package |
| nltk 3.9.x | RSLPStemmer and Portuguese stopwords already present |
| PostgreSQL + pgvector | Add FTS tsvector column; no new infrastructure |

### Add (no new runtime deps)

| Change | Mechanism |
|--------|-----------|
| BM25Plus variant | `from rank_bm25 import BM25Plus` — same package, no new dep |
| PostgreSQL full-text search pre-filter | `tsvector` generated column + GIN index via migration |
| pt-br localization | `src/bot/strings.py` constants module (stdlib only) |
| Keyboard factory layer | `src/bot/keyboards.py` (Telegram imports only) |
| Callback prefix router | `src/bot/callback_router.py` (no new dep) |
| BM25 cache TTL | In-instance timestamp, `time.monotonic()` (stdlib) |

### Remove / Replace

| Current | Replace with | Reason |
|---------|-------------|--------|
| God-handler `button_callback` | Prefix-based `callback_router.py` | Does not scale past 5 menu states |
| `BOT_MESSAGES` English dict | `strings.py` pt-br constants | Localization + centralization |
| `_rerank_with_gpt4o` synchronous path | Async `openai_client.structured_completion()` | Blocks event loop |
| GPT-4o re-ranking in search hot path | Local cross-encoder (optional, zero API cost) | Adds 1–3 s latency per query |
| `RELATED_TERMS` English-first dict | Portuguese-primary entries with English aliases | Bot is pt-br only |
| `ILIKE %term%` candidate fetch | `plainto_tsquery('portuguese', $1)` FTS pre-filter | Missed stemming variants |

### Explicitly ruled out

`aiogram`, `telebot`, `fluent-python`, `Babel` as primary i18n, `elasticsearch`, `ReplyKeyboardMarkup` for menus, `ConversationHandler` as the sole navigation mechanism, `bm25s` at current KB scale, Redis, and semantic re-ranking with a dedicated embedding model (v2 scope).

---

## Feature Categories

### Table stakes (launch blockers)

1. `/start` shows InlineKeyboard main menu immediately — no command knowledge required.
2. All user-facing strings in pt-br with professional tone.
3. InlineKeyboard for every guided step — no typing required during menu flows.
4. "Voltar" button at every non-root menu level.
5. "Menu Principal" button always reachable from any depth.
6. Edit-in-place navigation (`edit_message_text`) — never flood chat with new messages per step.
7. Breadcrumb text in message header (`Suporte Workforce > Tirar Duvida > Login`).
8. Guided error report collects area, symptom, timing, and frequency via buttons before creating ticket.
9. Confirmation step before submitting — show collected data, require user confirm.
10. KB browsable by category tree without typing.
11. After KB article: "Isso resolveu?" inline prompt; "Nao" pre-fills error report category.
12. Feedback collected inline after flow completion — not only via `/feedback` command.
13. Stale state graceful reset (time-based or on `/start`).
14. Free-text outside a flow routes to main menu, not "unknown command".

### Differentiators (post-launch value adds)

1. Duplicate detection before ticket creation: BM25 match against symptom text, offer KB result first.
2. Pre-fill category when navigating from KB article to error report.
3. Contextual "Veja tambem" related article suggestions after displaying a KB result.
4. Most-accessed KB articles ranked first within categories.
5. Per-article thumbs-up / thumbs-down rating.
6. First-time vs. returning user detection on `/start`.
7. Navigation stack enabling true N-level back-navigation (vs. simple parent reference).
8. Proactive feedback prompt when agent closes ticket via webhook.
9. State persistence to PostgreSQL (survives pod restarts).
10. Screenshot / photo attachment support during error report collection.

### Anti-features (deliberately not built)

1. Menu trees deeper than 3 levels — users lose context and abandon.
2. `ReplyKeyboardMarkup` as navigation — clutters chat, not dismissible per screen.
3. New message per navigation step — floods chat history.
4. Free-text required in guided flows — defeats guided menu purpose.
5. Blocking on feedback — never gate further interaction behind a rating.
6. Registration / authentication gates — internal tool; Telegram identity is sufficient.
7. Multilingual support (en/es) — out of scope, adds complexity with no current user need.
8. Web admin panel — out of scope this milestone.
9. More than 5 items at the root menu level.
10. Silent error swallowing — every error must show a user-friendly message with a recovery button.

---

## Architecture Approach

The menu system integrates as a parallel concern alongside the existing `ConversationState` machine — it does not replace it.

### Core integration model

`UserConversationState` gains two new fields: `menu_path: list[str]` (tracks where in the menu tree the user is) and `menu_context: dict` (transient per-menu-node data). This keeps menu position orthogonal to workflow state. When `state == IDLE` and `menu_path` is non-empty, the user is navigating. When `state != IDLE`, the user is in a report/validation workflow and menu navigation is suspended.

### Structural changes to `src/bot/`

```
src/bot/
├── handlers.py              # thin — register_handlers() + routing only
├── callback_router.py       # NEW — prefix-based CallbackQuery dispatcher
├── menu_handler.py          # NEW — menu tree navigation and state helpers
├── message_handler.py       # NEW — extracted handle_message() body
├── strings.py               # NEW — all pt-br strings as UPPER_SNAKE_CASE constants
├── keyboards.py             # NEW — all InlineKeyboardMarkup factory functions
├── conversation_manager.py  # EXTENDED — add menu_path, menu_context fields
├── templates.py             # KEEP — formatting functions, import from strings.py
└── state_handlers/
    ├── idle.py
    ├── awaiting_answer.py
    ├── providing_guidance.py
    └── escalated.py
```

### Callback data format

`{prefix}:{path}:{action}[:{param}]` — always under 64 bytes. State that does not fit (e.g., report IDs) is stored in `context.user_data` and looked up by `user_id`, never embedded in `callback_data`.

### Search pipeline (no interface changes)

`KnowledgeBaseSearcher` is extended internally: Portuguese-primary `RELATED_TERMS`, BM25Plus variant, TTL-based cache invalidation, async re-ranking fix, and simple in-instance LRU result cache. Repository interfaces and callers are unchanged.

---

## Critical Pitfalls

### 1. The 64-byte `callback_data` limit

**Risk:** Telegram silently rejects buttons whose `callback_data` exceeds 64 bytes UTF-8. Nested menus naturally accumulate context in the string. The button simply stops responding with no visible error.

**Prevention:** Enforce `{prefix}:{path}:{action}` with at most two parameters from day one. Store all runtime context in `UserConversationState`, never in `callback_data`. Add a unit test that asserts `len(data.encode("utf-8")) <= 64` for every registered callback value.

### 2. Breaking existing flows when adding menu handlers

**Risk:** A new `CallbackQueryHandler` or broad `MessageHandler` absorbs events intended for existing report/validation/escalation logic. The handler registration order in `register_handlers` determines priority.

**Prevention:** Write regression tests for all existing flows before touching `handlers.py`. Register handlers in the established order: specific command handlers -> callback handlers -> generic message handler. Keep existing `"yes_resolved"` and `"no_unresolved"` callbacks as registered handlers in the new router from day one.

### 3. `callback_query.answer()` must be called first, always

**Risk:** Telegram requires every `CallbackQuery` to be acknowledged via `query.answer()` within approximately 3 seconds. If a slow operation (KB search, DB query, LLM call) runs before `answer()`, the Telegram client shows an infinite loading spinner and may mark the callback as expired.

**Prevention:** `await query.answer()` is always the first line of any callback handler, unconditionally. For slow operations, use `query.answer(text="Buscando...")` to surface a loading hint, then edit the message with results.

### 4. State / message desynchronization

**Risk:** `edit_message_text` updates the visible UI while `ConversationManager` state update is a separate operation. If `edit_message_text` fails after state is updated (or vice versa), the user sees a menu that contradicts what the bot thinks the state is.

**Prevention:** Always update state and send the Telegram edit within the same try/except block. Track `menu_message_id` in `menu_context` so the bot can re-send the correct menu if the targeted message is no longer editable. Never leave these two operations un-coupled.

### 5. Search quality regression when tuning BM25 parameters

**Risk:** `k1`, `b`, and hybrid score weights (`0.4 * bm25 + 0.6 * gpt`) are hardcoded without a documented baseline. Any change can silently worsen results that previously worked. The BM25 `_doc_stats_cache` has no TTL, so stale scores after KB updates make this regression invisible.

**Prevention:** Before adjusting any parameter, create a minimum evaluation dataset (10–20 representative queries with expected top-3 results, measuring precision@3). Move all tuning parameters to `config.py`. Implement TTL-based cache invalidation. Run the evaluation dataset before and after any parameter change.

---

## Build Order

Based on component dependencies identified in ARCHITECTURE.md. Each phase is independently testable before the next begins.

```
Phase A: Strings and keyboards
  Create strings.py (pt-br constants) and keyboards.py (InlineKeyboard factories).
  Migrate BOT_MESSAGES to strings.py. Update /start and /help to pt-br.
  Test signal: /start returns pt-br welcome. All existing tests pass.

Phase B: Callback router
  Create callback_router.py with route_callback() and @register() decorator.
  Migrate existing yes_resolved / no_unresolved into registered handlers.
  Replace CallbackQueryHandler(button_callback) with CallbackQueryHandler(route_callback).
  Test signal: existing confirmation keyboard behavior unchanged.

Phase C: State extension
  Add menu_path: list[str] and menu_context: dict to UserConversationState.
  Add push_menu(), pop_menu(), current_menu() helpers.
  Test signal: dataclass change is backward-compatible, existing state transitions unaffected.

Phase D: Menu handler and main menu  [depends on B + C]
  Create menu_handler.py with send_main_menu() and handle_menu_callback().
  Register "menu:" prefix in callback router.
  Update start_command() and help_command() to call send_main_menu().
  Test signal: /start shows InlineKeyboard. Navigation and Voltar work.

Phase E: Full menu tree  [depends on D]
  Add duvidas submenu with all KB category nodes.
  Wire erro guided flow to existing report_command logic.
  Wire chamados node to existing list_command logic.
  Connect category nodes to KB results or free-text prompt.
  Test signal: full tree navigable, all Voltar buttons return to correct parent.

Phase F: handle_message() refactor  [depends on E]
  Create state_handlers/ package.
  Extract each ConversationState branch into its own module.
  Replace handle_message() body with dispatcher dict.
  Update idle handler to call send_menu_for_path() when menu_path is set.
  Test signal: all existing conversation flows identical. IDLE now re-sends menu.

Phase G: Search improvements  [independent of F, can run parallel after E]
  Extend RELATED_TERMS with Portuguese-primary entries.
  Add TTL to _doc_stats_cache.
  Fix _rerank_with_gpt4o to use async client.
  Add in-instance result cache for find_relevant_articles.
  Test signal: existing BM25 tests pass. New pt-br expansion tests pass. Cache TTL test verifies refresh.
```

Phases F and G are independent of each other and can run in parallel once Phase E is complete.

---

## Open Questions

### Architecture

1. **PTB `ConversationHandler` vs. manual menu_path:** ARCHITECTURE.md explicitly rules out using PTB's `ConversationHandler` for menus (the codebase avoids it and retrofitting would require restructuring all command handlers). STACK.md recommends a hybrid approach using `ConversationHandler` for the guided wizard. These recommendations are in tension and need a single resolved decision before Phase D begins.

2. **`menu_path` in `UserConversationState` vs. `context.user_data`:** The two documents suggest different storage locations for menu state. `context.user_data` enables PTB's built-in `PicklePersistence`; `UserConversationState` keeps the existing data model intact. The choice affects whether persistence is possible without additional work.

### Features

3. **Duplicate detection threshold:** The differentiator "BM25 match before opening ticket" requires a confidence threshold for what counts as a match. No threshold value has been researched or proposed. This must be defined before implementing the feature.

4. **KB category taxonomy:** Phase E requires `KBDocumentRepository.list_by_category()` and assumes KB documents are tagged with category identifiers. Whether existing KB documents have this tagging is unknown — requires a data audit before Phase E planning.

5. **`ESCALATED` state exit:** PITFALLS.md identifies `ESCALATED` as a terminal state with no graceful exit. Adding "Abrir Novo Chamado" from the escalation confirmation message is proposed but not sized or placed into a phase.

### Search

6. **BM25Plus parameter tuning baseline:** `k1=1.2, b=0.75, delta=1.0` are proposed in STACK.md but without empirical validation against the actual KB corpus. A minimum evaluation dataset is required before any parameter change; the dataset does not yet exist.

7. **Local cross-encoder for re-ranking:** Replacing `_rerank_with_gpt4o` with a local `sentence-transformers` cross-encoder is proposed as optional. The decision to include or exclude this in v2 is unresolved — it affects latency SLO and model storage requirements.

### Operations

8. **State persistence scope:** In-memory `ConversationManager` loses all state on pod restart. FEATURES.md lists PostgreSQL-backed state as a differentiator (not table stakes). This is an accepted known debt — but the question of whether pod restart frequency justifies addressing it in v2 is unresolved.
