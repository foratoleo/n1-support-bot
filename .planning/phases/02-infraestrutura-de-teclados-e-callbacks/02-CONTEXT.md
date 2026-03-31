# Phase 2: Infraestrutura de Teclados e Callbacks - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Criar a camada de infra que suporta toda a navegação por InlineKeyboard — módulo de keyboards, router de callbacks por prefixo, e conformidade com o limite de 64 bytes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from research:
- Create `src/bot/keyboards.py` with factory functions for all InlineKeyboard layouts
- Create `src/bot/callback_router.py` with prefix-based routing via `@register("prefix:")` decorator
- Callback data format: `{prefix}:{path}:{action}[:{param}]` — must stay under 64 bytes UTF-8
- Every CallbackQueryHandler must call `await query.answer()` as first line
- Existing button_callback flows (yes_resolved, no_unresolved) must continue working after migration
- Single `CallbackQueryHandler(route_callback)` replaces current handler

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/bot/strings.py` — pt-br button labels (BTN_YES_RESOLVED, BTN_NO_UNRESOLVED, etc.)
- `src/bot/templates.py` — `get_confirmation_keyboard()` already builds InlineKeyboard

### Established Patterns
- Async handlers with python-telegram-bot 21.7
- `button_callback()` in handlers.py handles all callbacks via if/elif chain
- Callback data currently: "yes_resolved", "no_unresolved", "search_X", "feedback_X_Y"

### Integration Points
- `src/bot/handlers.py` — register_handlers() where handlers are registered
- `button_callback()` — existing callback handler to decompose
- `get_confirmation_keyboard()` in templates.py — to migrate to keyboards.py

</code_context>

<specifics>
## Specific Ideas

- Research recommends prefix-based router with decorator pattern
- All callback_data values must be tested against 64-byte limit
- Router should support easy addition of new prefixes without modifying existing code

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
