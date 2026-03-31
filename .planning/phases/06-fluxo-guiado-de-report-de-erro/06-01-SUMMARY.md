# Phase 6 Plan 01 — Summary: Guided Error Report Wizard

**Created:** 2026-03-30
**Last updated:** 2026-03-30
**Status:** Complete

## What Was Built

Full inline-button wizard for error reporting covering requirements RPT-01 through RPT-11.

### Step Flow

1. Area selection (4 options)
2. Symptom selection (4 options per area = 16 total)
3. When the problem started (4 options)
4. Frequency (4 options)
5. Optional details (free text or photo, with Skip button)
6. Confirmation screen showing all collected data
7. Submit (creates record in DB) or Correct (go back)

### Key Features Delivered

- RPT-01 to RPT-04: complete button-only flow for area, symptom, when, frequency
- RPT-05: optional details step accepts free text or photo (screenshot)
- RPT-06: BM25 duplicate detection via `KnowledgeBaseSearcher` before creating ticket
- RPT-07: unique report ID displayed after submission (short UUID prefix)
- RPT-08: confirmation screen shows all collected data before submit
- RPT-09: `start_report_wizard(from_kb_category=...)` pre-fills area when coming from KB article
- RPT-10: `rpt:back` correctly navigates back through wizard steps
- RPT-11: `menu:main` always available to abort wizard

### Files Created

- `/Users/forato-dr/Desktop/projects/ragworkforce/src/bot/report_wizard.py` — 240 lines

### Files Modified

- `src/bot/conversation_manager.py`
- `src/bot/strings.py`
- `src/bot/keyboards.py`
- `src/bot/callback_router.py`
- `src/bot/_callback_handlers.py`
- `src/bot/handlers.py`

### Commit

`3a2ec3e` — feat(phase-6): implement guided error report wizard (RPT-01 to RPT-11)
