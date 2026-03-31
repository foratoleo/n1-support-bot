# Phase 6 — Context: Fluxo Guiado de Report de Erro

**Created:** 2026-03-30
**Last updated:** 2026-03-30

## Objective

Implement the complete guided error report collection flow via inline buttons, with confirmation before submission and screenshot support (RPT-01 through RPT-11).

## Files Modified

- `src/bot/conversation_manager.py` — added `COLLECTING_REPORT` to `ConversationState` enum
- `src/bot/strings.py` — added all wizard strings with correct Portuguese diacritics
- `src/bot/keyboards.py` — added 7 keyboard factory functions for wizard steps
- `src/bot/report_wizard.py` — new module with full wizard state machine
- `src/bot/callback_router.py` — registered `src.bot.report_wizard` import
- `src/bot/_callback_handlers.py` — `_handle_menu_erro` now delegates to wizard
- `src/bot/handlers.py` — `handle_message` handles `COLLECTING_REPORT` state; photo handler registered

## Architecture Decisions

- Wizard state stored in `user_state.menu_context["rpt_wizard"]` as a dict with keys: `step`, `area`, `symptom`, `when`, `frequency`, `details`, `photo_id`, `from_kb_category`, `pending_description`
- All navigation uses `edit_message_text` to avoid flooding the chat
- `rpt:back` resolves previous step via `_WIZARD_STEPS` ordered list
- Duplicate detection reuses existing `KnowledgeBaseSearcher.find_relevant_articles` (BM25)
- Photo support: `filters.PHOTO` handler added to PTB application; file_id stored in wizard context
- Pre-fill from KB article (RPT-09): `start_report_wizard(from_kb_category=...)` skips area step

## Callback Prefix Map

| Prefix | Handler |
|--------|---------|
| `rpt:area:<id>` | select area |
| `rpt:symptom:<id>` | select symptom |
| `rpt:when:<id>` | select when |
| `rpt:freq:<id>` | select frequency |
| `rpt:details:skip` | skip optional details |
| `rpt:back` | go back one step |
| `rpt:confirm:submit` | create report |
| `rpt:dup:yes` | accept duplicate as resolved |
| `rpt:dup:no` | ignore duplicate, create anyway |
