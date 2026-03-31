# Phase 1: Localizacao e Strings - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Centralizar todas as strings do bot em pt-br com tom profissional cordial em um modulo dedicado, eliminando strings hardcoded dos handlers.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from research:
- Create `src/bot/strings.py` with UPPER_SNAKE_CASE constants (matches existing convention for STOPWORDS, RELATED_TERMS)
- LLM system prompts rewritten directly in pt-BR (not through gettext)
- Tom profissional cordial: educado, claro, sem girias, tratamento por "voce"
- Mensagens de erro acolhedoras com opcao de acao (voltar ao menu, tentar novamente)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/bot/templates.py` — existing message formatting functions
- `BOT_MESSAGES` dict in `handlers.py` — current string storage (to be migrated)

### Established Patterns
- Constants use UPPER_SNAKE_CASE
- Handlers import from local modules
- Strings currently mixed between BOT_MESSAGES dict and inline in handlers

### Integration Points
- `src/bot/handlers.py` — all user-facing strings live here
- `src/utils/openai_client.py` — LLM system prompts
- `src/bot/templates.py` — message formatting

</code_context>

<specifics>
## Specific Ideas

- Research identified 8 hardcoded strings in handlers.py outside BOT_MESSAGES (lines 89, 203, 449, 462, 489, 498, 529, 549)
- All strings must be pt-br including error messages and fallbacks
- System prompts for LLM must generate responses in pt-br with professional cordial tone

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
