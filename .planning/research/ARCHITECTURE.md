# Research: Menu System and Search Integration Architecture

**Created:** 2026-03-30
**Last Updated:** 2026-03-30
**Scope:** Milestone v2 — InlineKeyboard menu navigation, improved search, pt-br interface

---

## 1. Diagnosis: Current Architecture Constraints

Before proposing integration strategies, it is necessary to understand what the current codebase enforces.

### What exists and must be preserved

- `handlers.py` registers handlers via `register_handlers(application)` — a flat list with no `ConversationHandler`. There is no PTB conversation handler wrapping the flow today. The state machine lives entirely in `ConversationManager` (in-memory dict).
- `button_callback` in `handlers.py` handles all `CallbackQueryHandler` events with a single function that switches on `query.data` strings (`"yes_resolved"`, `"no_unresolved"`). There is no routing layer — every new button must be an additional `elif` branch in that function, which does not scale.
- `handle_message()` is a 200-line monolith that dispatches on `user_state.state`. Each state is an `if` block with full async DB access interleaved. Adding menu navigation states here would make it unreadable.
- `UserConversationState` tracks only report-workflow state. It has no concept of "where in the menu tree the user currently is."
- `templates.py` is a flat dict of English string literals (`BOT_MESSAGES`). There is no loading mechanism, no locale separation, no keyboard factory beyond `get_confirmation_keyboard()`.

### What the new requirements demand

- A multi-level InlineKeyboard tree navigable via `CallbackQuery` events.
- A "Back" button at every level, which requires knowing where the user is in the tree.
- The menu entry point must coexist with the existing report/validation/escalation flow, not replace it.
- All strings in pt-br, including buttons and error messages.
- Improved search without changing the repository interface.

---

## 2. CallbackQuery Handler Architecture for Deep Menu Trees

### The scaling problem with the current approach

The current `button_callback` does a flat `if/elif` chain on raw strings. For a menu tree with 3+ levels and a "Back" button at each node, this approach breaks — the number of branches grows with every menu item, the function accumulates context it cannot track, and the callback data carries no positional information.

### Recommended approach: Router + Handler map

Replace the single `button_callback` with a routing layer that dispatches to dedicated handler functions based on a prefix extracted from `callback_data`.

```
CallbackQueryHandler(route_callback)
    ↓
MenuRouter.dispatch(query.data)
    ↓
    "menu:"  → MenuNavigationHandler.handle(...)
    "search_page:" → SearchPaginationHandler.handle(...)
    "report_confirm:" → ReportConfirmHandler.handle(...)
    "yes_resolved" / "no_unresolved" → existing ResolutionHandler.handle(...)
```

**Implementation pattern:**

```python
# src/bot/callback_router.py

HANDLERS: dict[str, Callable] = {}

def register(prefix: str):
    def decorator(fn):
        HANDLERS[prefix] = fn
        return fn
    return decorator

async def route_callback(update: Update, context) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    for prefix, handler in HANDLERS.items():
        if data.startswith(prefix) or data == prefix:
            await handler(update, context)
            return
    # fallback: unknown callback
    await query.edit_message_text(MSG["erro_acao_invalida"])
```

Each handler module decorates its functions with `@register("menu:")`, keeping concerns separated. The existing `"yes_resolved"` and `"no_unresolved"` behaviors become their own handler registered with exact-match prefixes, requiring no changes to existing logic.

### Handler registration in `register_handlers`

Replace:
```python
application.add_handler(CallbackQueryHandler(button_callback))
```

With:
```python
application.add_handler(CallbackQueryHandler(route_callback))
```

No other changes to `main.py` or the registration surface.

---

## 3. Callback Data Design

Callback data in Telegram is limited to 64 bytes. The design must encode menu position, action, and optional payload within that budget.

### Format specification

```
{prefix}:{path}:{action}[:{param}]
```

| Segment | Purpose | Example |
|---------|---------|---------|
| `prefix` | Routes to the correct handler | `menu` |
| `path` | Identifies the current node in the tree | `main`, `duvidas`, `duvidas.login` |
| `action` | What should happen | `open`, `back`, `select` |
| `param` | Optional: page number, item ID, category | `2`, `login_auth` |

**Examples:**

```
menu:main:open
menu:duvidas:open
menu:duvidas.login:open
menu:duvidas:back
search_page:duvidas:2
report_flow:start:tirar_duvida
report_flow:start:reportar_erro
```

### Byte budget

`menu:duvidas.document_generation:open` = 38 chars — within budget. Even the deepest anticipated path stays under 50 chars when using abbreviated node names.

### Node naming convention

Use dot-separated short identifiers:
- `main` — root menu
- `duvidas` — "Tirar Dúvidas"
- `duvidas.login` — Login subcategory under Dúvidas
- `erro` — "Reportar Erro"
- `erro.coleta` — data collection step under Reportar Erro

---

## 4. State Management for Menu Navigation

### The conflict with existing state machine

`ConversationState` (IDLE, AWAITING_VALIDATION_ANSWER, etc.) tracks the report workflow. Menu navigation is a separate concern: the user may browse the menu tree before deciding to report. These two state dimensions are orthogonal.

### Recommended approach: Two-field state model

Extend `UserConversationState` with a `menu_path` field rather than adding new `ConversationState` enum values. This avoids conflating menu position with workflow stage.

```python
@dataclass
class UserConversationState:
    state: ConversationState           # existing: IDLE, AWAITING_VALIDATION_ANSWER, etc.
    user_id: int
    menu_path: list[str] = field(default_factory=list)  # NEW: ["main"] or ["duvidas", "login"]
    menu_context: dict = field(default_factory=dict)     # NEW: transient menu-level data
    # ... all existing fields unchanged ...
```

**Rules:**
- When `state == IDLE` and `menu_path` is non-empty: user is navigating the menu.
- When `state != IDLE`: user is in the report/validation workflow. Menu navigation is disabled.
- Pressing "Back" from `menu_path == ["main"]` sends the main menu again (no pop).
- `menu_path` is cleared when the workflow starts (user clicks "Reportar Erro" or "Tirar Dúvidas").

### Menu stack push/pop

```python
# MenuNavigationHandler helpers (in src/bot/menu_handler.py)

def push_menu(user_id: int, node: str) -> None:
    state = conv_manager.get_user_state(user_id)
    state.menu_path.append(node)

def pop_menu(user_id: int) -> str | None:
    state = conv_manager.get_user_state(user_id)
    if len(state.menu_path) > 1:
        return state.menu_path.pop()
    return state.menu_path[0] if state.menu_path else None

def current_menu(user_id: int) -> str:
    state = conv_manager.get_user_state(user_id)
    return state.menu_path[-1] if state.menu_path else "main"
```

### Persistence note

The existing `ConversationManager` is in-memory. For the menu system this is acceptable as a starting point: menu state is ephemeral by nature (losing the position on bot restart is tolerable — the user simply gets the main menu again). Migrating conversation state to the database is a separate concern documented in CONCERNS.md and is out of scope for this milestone.

---

## 5. Coexistence with the Existing Conversation State Machine

### The entry point conflict

Currently, `/start` sends a plain text welcome message (English). The new requirement is that `/start` opens the main menu with InlineKeyboard. This is the entry point where the menu system begins.

### Transition protocol

```
/start or /help
    ↓
send_main_menu()
    → sets menu_path = ["main"]
    → state remains IDLE

User clicks "Tirar Dúvidas"
    ↓
menu:duvidas:open
    → sets menu_path = ["main", "duvidas"]
    → state remains IDLE

User clicks a category (e.g. "Login / Acesso")
    ↓
menu:duvidas.login:select
    → initiates free-text question flow OR shows KB results
    → state transitions to AWAITING_VALIDATION_ANSWER (existing machine takes over)
    → menu_path cleared

User clicks "Reportar Erro"
    ↓
report_flow:start:reportar_erro
    → state transitions to AWAITING_REPORT (guided collection flow)
    → menu_path cleared
```

### The `handle_message()` function during menu navigation

When the user is in `IDLE` state and `menu_path` is non-empty, they are in the menu. Free-text messages during menu navigation should be handled gracefully:

```python
if user_state.state == ConversationState.IDLE:
    if user_state.menu_path:
        # User sent text while browsing menu — re-show current menu node
        await send_menu_for_path(update, user_state.menu_path[-1])
    else:
        # No active menu — send main menu instead of current English prompt
        await send_main_menu(update, context)
    return
```

This change replaces the current IDLE text response in `handle_message()` without touching any other branch.

---

## 6. Refactoring `handle_message()` to Support Menus

### The 200-line problem

`handle_message()` currently mixes state dispatch, DB access, business logic, and message formatting. The pattern to apply is Extract Method into state-specific handler classes or functions, each with a single responsibility.

### Recommended structure after refactor

```
src/bot/
├── handlers.py              # thin — only register_handlers() + routing
├── callback_router.py       # NEW — CallbackQuery routing
├── menu_handler.py          # NEW — menu tree navigation
├── conversation_manager.py  # extended with menu_path
├── message_handler.py       # NEW — extracted handle_message() body
├── templates.py             # extended with pt-br strings
└── state_handlers/
    ├── __init__.py
    ├── idle.py              # handle_idle_state()
    ├── awaiting_answer.py   # handle_awaiting_answer_state()
    ├── providing_guidance.py # handle_providing_guidance_state()
    └── escalated.py         # handle_escalated_state()
```

**`message_handler.py` after refactor:**

```python
async def handle_message(update: Update, context) -> None:
    if not update.message.text:
        await update.message.reply_text(MSG["somente_texto"])
        return
    user_id = update.effective_user.id
    user_state = conv_manager.get_user_state(user_id)

    dispatcher = {
        ConversationState.IDLE: handle_idle_state,
        ConversationState.AWAITING_VALIDATION_ANSWER: handle_awaiting_answer_state,
        ConversationState.PROVIDING_GUIDANCE: handle_providing_guidance_state,
        ConversationState.ESCALATED: handle_escalated_state,
    }
    handler_fn = dispatcher.get(user_state.state)
    if handler_fn:
        await handler_fn(update, context, user_state)
    else:
        await update.message.reply_text(MSG["erro_geral"])
```

Each `handle_*_state` function is a module-level async function in its own file, receiving `update`, `context`, and `user_state`. No logic lives in `handlers.py` itself.

### Migration strategy

This refactor can be done incrementally:
1. Extract `handle_escalated_state` first (simplest — one reply line).
2. Extract `handle_providing_guidance_state` next.
3. Extract `handle_awaiting_answer_state` last (most complex).
4. Replace `handle_message` body with the dispatcher table.

At no point does the public signature of `handle_message` change, so `register_handlers` requires no modification.

---

## 7. Message Template System for pt-br

### Current state

`templates.py` contains `BOT_MESSAGES`, a flat Python dict of English strings. Keyboards are defined as inline code in `get_confirmation_keyboard()`. There is no separation between string storage and string rendering, and no locale mechanism.

### Recommended approach: Dedicated strings module with constants

For this project's scope (pt-br only, no multilingual requirement), a full i18n library is over-engineered. The right approach is a dedicated `strings.py` module that contains all user-visible text as named constants, with the `BOT_MESSAGES` dict replaced.

```
src/bot/
├── strings.py       # NEW — all pt-br strings as module-level constants
├── keyboards.py     # NEW — all InlineKeyboardMarkup factories
├── templates.py     # keep for formatting functions, import from strings.py
```

**`strings.py` pattern:**

```python
# src/bot/strings.py
"""Todas as strings visíveis ao usuário em pt-br."""

# Boas-vindas e navegação
BEM_VINDO = (
    "Olá! Sou o assistente de suporte do Workforce.\n\n"
    "Como posso te ajudar hoje?"
)
MENU_PRINCIPAL_TITULO = "Menu Principal"
MENU_TIRAR_DUVIDAS = "Tirar Dúvidas"
MENU_REPORTAR_ERRO = "Reportar Erro"
MENU_MEUS_CHAMADOS = "Meus Chamados"
MENU_VOLTAR = "Voltar"

# Categorias de dúvidas
CATEGORIA_LOGIN = "Login / Acesso"
CATEGORIA_DOCUMENTOS = "Documentos"
CATEGORIA_TAREFAS = "Tarefas e Sprints"
CATEGORIA_DADOS = "Dados não aparecem"
CATEGORIA_OUTRO = "Outro assunto"

# Fluxo de reporte
REPORTE_DESCREVA = (
    "Por favor, descreva o erro que você está enfrentando.\n\n"
    "Quanto mais detalhes, mais rápido conseguimos ajudar."
)
# ... etc.

# Erros
ERRO_GERAL = "Algo deu errado. Use /cancelar para reiniciar ou tente novamente."
SOMENTE_TEXTO = "Por favor, envie uma mensagem de texto."
```

Constants are UPPER_SNAKE_CASE following the project's existing convention for module-level identifiers (`STOPWORDS`, `RELATED_TERMS`, `CATEGORY_KEYWORDS`).

**`keyboards.py` pattern:**

```python
# src/bot/keyboards.py
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from .strings import (MENU_TIRAR_DUVIDAS, MENU_REPORTAR_ERRO, MENU_MEUS_CHAMADOS, MENU_VOLTAR, ...)

def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(MENU_TIRAR_DUVIDAS, callback_data="menu:duvidas:open")],
        [InlineKeyboardButton(MENU_REPORTAR_ERRO, callback_data="report_flow:start:reportar_erro")],
        [InlineKeyboardButton(MENU_MEUS_CHAMADOS, callback_data="menu:chamados:open")],
    ])

def duvidas_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(CATEGORIA_LOGIN, callback_data="menu:duvidas.login:select")],
        [InlineKeyboardButton(CATEGORIA_DOCUMENTOS, callback_data="menu:duvidas.documentos:select")],
        [InlineKeyboardButton(CATEGORIA_TAREFAS, callback_data="menu:duvidas.tarefas:select")],
        [InlineKeyboardButton(CATEGORIA_DADOS, callback_data="menu:duvidas.dados:select")],
        [InlineKeyboardButton(CATEGORIA_OUTRO, callback_data="menu:duvidas.outro:select")],
        [InlineKeyboardButton(MENU_VOLTAR, callback_data="menu:main:back")],
    ])

# One function per menu node. No logic — pure keyboard construction.
```

**Migration from `BOT_MESSAGES`:** The existing format functions in `templates.py` (`format_acknowledge`, `format_escalation`, etc.) can keep their signatures but import string constants from `strings.py` instead of `BOT_MESSAGES`. This is a non-breaking change: callers in `handlers.py` are unaffected.

---

## 8. Search Pipeline Improvements

### Current pipeline diagnosis

```
User text
  → _extract_search_terms()   [tokenize + stopwords]
  → _expand_query_terms()     [RELATED_TERMS dict lookup]
  → _bm25_search()            [ILIKE candidates → in-memory BM25]
  → _deduplicate_results()    [title/content signature]
  → optional _rerank_with_gpt4o()
  → return top-K
```

Three specific weaknesses relevant to the v2 milestone:

1. **RELATED_TERMS is English-centric.** The dict has English keys and some Portuguese mixed in inconsistently. For a pt-br-only bot, the expansion dict needs Portuguese-first entries.

2. **`_doc_stats_cache` has no TTL.** It is populated once per `KnowledgeBaseSearcher` instance and never invalidated. Since the KB is populated via `seed_kb.py`, this means BM25 IDF scores are always stale after an update. The fix is a TTL-based invalidation.

3. **Re-ranking uses a synchronous-style API call.** The `_rerank_with_gpt4o()` method calls `self.openai_client.chat.completions.create(...)` — this is the synchronous OpenAI SDK path. The rest of the codebase uses the async client via `await`. This is inconsistent and may block the event loop.

### Where to add improvements

**Query expansion (pt-br terms):** In `src/rag/knowledge_base.py`, extend `RELATED_TERMS` with Portuguese-primary keys. This is additive — no interface changes.

```python
RELATED_TERMS = {
    # Portuguese-primary entries (new)
    'senha': ['password', 'credencial', 'acesso', 'auth'],
    'login': ['entrar', 'acessar', 'signin', 'autenticar'],
    'tarefa': ['task', 'atividade', 'item', 'todo', 'pendência'],
    'sprint': ['iteração', 'ciclo', 'rodada'],
    'documento': ['doc', 'arquivo', 'relatório', 'geração'],
    'erro': ['bug', 'falha', 'problema', 'issue', 'exception'],
    'dados': ['data', 'informação', 'registro', 'conteúdo'],
    'projeto': ['project', 'workspace', 'organização'],
    # ... existing English entries retained ...
}
```

**BM25 cache TTL:** Add a `_doc_stats_cache_at` timestamp to `KnowledgeBaseSearcher`. Invalidate if older than a configurable TTL (default 5 minutes). No interface changes.

```python
# In __init__:
self._doc_stats_cache_ttl: int = 300  # seconds, from config
self._doc_stats_cache_at: float = 0.0

# In _ensure_doc_stats():
import time
if self._doc_stats_cache is not None:
    if time.monotonic() - self._doc_stats_cache_at < self._doc_stats_cache_ttl:
        return
# fetch and update self._doc_stats_cache_at = time.monotonic()
```

**Re-ranking async fix:** The `_rerank_with_gpt4o` method should use `await self.openai_client.structured_completion(...)` (the existing async wrapper in `src/utils/openai_client.py`) rather than calling the underlying client directly. This aligns with the pattern already used in `IssueClassifier._classify_with_openai()`.

**Result caching for repeated identical queries:** For the menu-driven "Tirar Dúvidas" flow, the same KB category query will be issued by multiple users. A simple LRU cache on `find_relevant_articles(issue_description, area)` — keyed on `(normalized_query, area, limit)` — eliminates redundant DB hits. The `functools.lru_cache` decorator is not usable on async methods; use a manual `dict` cache with TTL on the `KnowledgeBaseSearcher` instance.

**Where NOT to add complexity now:** Full semantic re-ranking with a dedicated embedding model, pgvector activation, or Redis-backed caching are explicitly out of scope for this milestone. The improvements above require no new dependencies.

---

## 9. Component Boundaries and Data Flow

### Component map

```
Presentation Layer (src/bot/)
┌─────────────────────────────────────────────────────┐
│  handlers.py          — register_handlers() only     │
│  message_handler.py   — route free-text by state     │
│  callback_router.py   — route CallbackQuery by prefix │
│  menu_handler.py      — menu navigation logic         │
│  state_handlers/      — one module per state         │
│  conversation_manager.py — state + menu_path          │
│  strings.py           — all pt-br strings            │
│  keyboards.py         — all InlineKeyboard factories  │
│  templates.py         — formatting functions         │
└───────────────────────┬─────────────────────────────┘
                        │ calls
Application Layer (src/escalation/, src/validation/)
┌─────────────────────────────────────────────────────┐
│  EscalationHandler    — unchanged                    │
│  IssueClassifier      — unchanged                    │
│  QuestionGenerator    — unchanged                    │
└───────────────────────┬─────────────────────────────┘
                        │ calls
RAG Layer (src/rag/)
┌─────────────────────────────────────────────────────┐
│  KnowledgeBaseSearcher — extended: TTL cache,        │
│                          pt-br RELATED_TERMS,        │
│                          async re-ranking fix,       │
│                          result cache                │
│  EmbeddingGenerator   — unchanged                    │
└───────────────────────┬─────────────────────────────┘
                        │ calls
Data Layer (src/database/)
┌─────────────────────────────────────────────────────┐
│  All repositories     — unchanged                    │
│  DatabasePool         — unchanged                    │
└─────────────────────────────────────────────────────┘
```

### Data flow: Menu navigation

```
User presses "Tirar Dúvidas" button
  ↓
CallbackQueryHandler → route_callback(update, context)
  ↓
data = "menu:duvidas:open"
  → MenuNavigationHandler.handle(update, context)
      ↓
      push_menu(user_id, "duvidas")
      await query.edit_message_text(
          text=MENU_DUVIDAS_TITULO,
          reply_markup=duvidas_menu_keyboard()
      )
      [no DB access, no RAG, no classification]
```

### Data flow: Entering guided search from menu

```
User presses "Login / Acesso" under Dúvidas
  ↓
data = "menu:duvidas.login:select"
  → MenuNavigationHandler.handle_select(update, context)
      ↓
      area = "login_auth"  (derived from node name)
      articles = await kb_searcher.find_relevant_articles(
          issue_description="",
          area=area,
          limit=5
      )
      if articles:
          await query.edit_message_text(
              format_kb_results_ptbr(articles),
              reply_markup=results_keyboard(articles, area)
          )
          conv_manager.update_user_state(user_id, ConversationState.IDLE)
          # menu_path left as-is for Back navigation
      else:
          # prompt free-text question
          await query.edit_message_text(REPORTE_DESCREVA_DUVIDA)
          conv_manager.update_user_state(user_id, ConversationState.AWAITING_VALIDATION_ANSWER, ...)
```

### Data flow: Back button

```
User presses "Voltar" from "duvidas" menu
  ↓
data = "menu:main:back"
  → MenuNavigationHandler.handle_back(update, context)
      ↓
      pop_menu(user_id)        # removes "duvidas", returns to ["main"]
      await query.edit_message_text(
          text=BEM_VINDO,
          reply_markup=main_menu_keyboard()
      )
```

---

## 10. Suggested Build Order

Dependencies between components drive the sequence. Each phase can be tested independently before the next begins.

### Phase A: Strings and keyboards (no behavior change)

1. Create `src/bot/strings.py` — all pt-br string constants.
2. Create `src/bot/keyboards.py` — all keyboard factory functions importing from `strings.py`.
3. Migrate `BOT_MESSAGES` references in `templates.py` to use constants from `strings.py`. Keep `templates.py` as the formatting layer.
4. Update `/start` and `/help` to send pt-br text.

**Test signal:** `/start` returns a pt-br welcome message. No other behavior changes. All existing tests pass.

### Phase B: Callback router (infrastructure, no menu yet)

1. Create `src/bot/callback_router.py` with `route_callback()` and `@register()`.
2. Migrate existing `button_callback` logic into two registered handlers (`"yes_resolved"` and `"no_unresolved"`).
3. Replace `CallbackQueryHandler(button_callback)` with `CallbackQueryHandler(route_callback)` in `register_handlers`.

**Test signal:** Existing confirmation keyboard behavior is unchanged. No regressions.

### Phase C: Menu state extension

1. Add `menu_path: list[str]` and `menu_context: dict` to `UserConversationState`.
2. Add `clear_user_state()` to also reset `menu_path`.
3. Add menu stack helpers (`push_menu`, `pop_menu`, `current_menu`) to `conversation_manager.py` or a new `menu_handler.py`.

**Test signal:** State dataclass changes are backward-compatible. Existing state transitions unaffected.

### Phase D: Menu handler and main menu

1. Create `src/bot/menu_handler.py` with `send_main_menu()` and `handle_menu_callback()`.
2. Register `"menu:"` prefix in callback router.
3. Update `start_command()` and `help_command()` to call `send_main_menu()`.
4. Implement the main menu node with "Tirar Dúvidas", "Reportar Erro", "Meus Chamados" buttons.

**Test signal:** `/start` shows InlineKeyboard. Clicking buttons navigates. "Voltar" works.

### Phase E: Menu tree expansion (all submenus)

1. Add `duvidas` submenu with all category nodes.
2. Add `erro` guided collection flow wired to existing `report_command` logic.
3. Add `chamados` node wired to existing `list_command` logic.
4. Wire each category node to either KB results or free-text input prompt.

**Test signal:** Full menu tree navigable. All Back buttons return to correct parent.

### Phase F: handle_message() refactor

1. Create `src/bot/state_handlers/` package.
2. Extract each state branch into its own module under `state_handlers/`.
3. Replace `handle_message()` body with dispatcher dict.
4. Update IDLE handler to call `send_menu_for_path()` when `menu_path` is set.

**Test signal:** All conversation flows (report, validation, guidance, escalation) behave identically to before. The only visible change is the IDLE state now re-sends the menu rather than a command prompt.

### Phase G: Search improvements

1. Extend `RELATED_TERMS` in `knowledge_base.py` with pt-br primary entries.
2. Add TTL to `_doc_stats_cache`.
3. Fix `_rerank_with_gpt4o` to use the async client.
4. Add simple in-instance result cache for `find_relevant_articles`.

**Test signal:** Existing BM25 tests pass. New tests verify pt-br term expansion returns relevant results. Cache TTL test verifies stats are refreshed after expiry.

### Dependency graph summary

```
Phase A (strings/keyboards)
  ↓
Phase B (callback router)        Phase C (state extension)
  ↓                                ↓
Phase D (menu handler) ←───────────┘
  ↓
Phase E (full menu tree)
  ↓
Phase F (handle_message refactor)   Phase G (search improvements)
```

Phases F and G are independent of each other and can run in parallel after Phase E is complete.

---

## 11. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Prefix-based callback router, not multiple `CallbackQueryHandler` instances | PTB processes only the first matching handler; a single router avoids registration order bugs and scales to any number of menu items |
| `menu_path` as a list in existing state dataclass | Avoids introducing a second parallel state machine; the two dimensions (workflow state + menu position) are orthogonal and must not be conflated |
| No `ConversationHandler` from PTB | The existing codebase explicitly avoids it; adding it mid-project would require restructuring all command handlers and adding state constants to PTB's internal dispatcher |
| Dedicated `strings.py` constants, not a JSON/YAML file | Consistent with existing codebase conventions (UPPER_SNAKE_CASE module-level constants); avoids adding a loader dependency for a single-locale project |
| `keyboards.py` separate from `templates.py` | Keyboard construction requires Telegram imports; keeping them separate avoids coupling string formatting to Telegram object creation |
| TTL cache in-instance, not Redis | No Redis in current stack; in-memory TTL is sufficient for single-process deployment via Docker Compose |
| Incremental extraction of `handle_message()` per-state, not a rewrite | Reduces regression risk; each extracted module can be tested individually before the next is extracted |
