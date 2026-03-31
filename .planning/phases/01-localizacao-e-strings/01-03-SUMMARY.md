---
phase: 1
plan: 3
title: "Migrar src/bot/handlers.py e src/escalation/handler.py para usar strings.py"
status: complete
completed_at: "2026-03-30"
---

# Sumário — Plano 01-03

## O que foi feito

### Tarefa 1 — src/bot/handlers.py

Adicionado import `from src.bot import strings` logo após os imports locais existentes.

Substituídas 21 strings hardcoded em inglês pelas constantes correspondentes de `src/bot/strings.py`:

| Local | Constante utilizada |
|-------|---------------------|
| `/report` sem args | `strings.REPORT_MISSING_ARGS` |
| `/status` sem args | `strings.STATUS_MISSING_ARGS` |
| `/status` UUID inválido | `strings.STATUS_INVALID_ID` |
| `/status` relatório não encontrado | `strings.STATUS_NOT_FOUND.format(...)` |
| Mensagem não-texto | `strings.NON_TEXT_MESSAGE` |
| Estado IDLE recebe mensagem | `strings.IDLE_REDIRECT` |
| Após todas as respostas de validação | `strings.VALIDATION_ANALYZING` |
| Fallback de step em self-service | `strings.DEFAULT_SELF_SERVICE_STEP` |
| Fallback de issue_description em format_escalation | `strings.DEFAULT_ISSUE_DESCRIPTION` |
| Estado ESCALATED recebe mensagem | `strings.ESCALATED_STATE_MESSAGE` |
| `/search` sem args | `strings.SEARCH_MISSING_ARGS` |
| Nenhum resultado de busca | `strings.SEARCH_NO_RESULTS.format(...)` |
| UUID de usuário inválido em `/list` | `strings.LIST_INVALID_USER` |
| Sem relatórios em `/list` | `strings.LIST_NO_REPORTS` |
| `/feedback` sem args | `strings.FEEDBACK_MISSING_ARGS` |
| Rating inválido em `/feedback` | `strings.FEEDBACK_INVALID_RATING` |
| UUID inválido em `/feedback` | `strings.FEEDBACK_INVALID_ID` |
| Relatório não encontrado em `/feedback` | `strings.FEEDBACK_NOT_FOUND.format(...)` |
| Callback `yes_resolved` | `strings.CALLBACK_RESOLVED` |
| Callback `no_unresolved` | `strings.CALLBACK_NOT_RESOLVED` |
| Summary de escalação no callback | `strings.CALLBACK_ESCALATION_SUMMARY` |

### Tarefa 2 — src/escalation/handler.py

Adicionado import `from src.bot import strings` logo após os imports da stdlib.

Reescritos os métodos `format_escalation_message()` e `format_self_service_message()` com 8 referências a constantes:

| Método | Constante utilizada |
|--------|---------------------|
| `format_escalation_message` | `strings.ESCALATION_MESSAGE.format(...)` |
| `format_escalation_message` | `strings.DEFAULT_PROJECT_NOT_SPECIFIED` |
| `format_escalation_message` | `strings.DEFAULT_IMPACT_UNDETERMINED` |
| `format_escalation_message` | `strings.ESCALATION_WORKAROUNDS_HEADER` |
| `format_escalation_message` | `strings.ESCALATION_KNOWN_ISSUES_TIP` |
| `format_self_service_message` | `strings.ESCALATION_SELF_SERVICE_INTRO` |
| `format_self_service_message` | `strings.ESCALATION_STEPS_HEADER` |
| `format_self_service_message` | `strings.ESCALATION_NOT_RESOLVED_FOLLOWUP` |

## Verificações executadas

- Sintaxe Python válida em ambos os arquivos (`syntax OK`)
- `grep -c "strings\." src/bot/handlers.py` retornou 21 (>= 20)
- `grep -c "strings\." src/escalation/handler.py` retornou 8 (>= 8)
- Nenhuma string user-facing em inglês restante em `handlers.py`
- Nenhuma string em inglês restante em `escalation/handler.py`

## Commits

- `3c2bf94` — feat(i18n): migrate handlers.py to use strings.py constants
- `e8971ef` — feat(i18n): migrate escalation/handler.py to use strings.py constants

## Arquivos modificados

- `src/bot/handlers.py`
- `src/escalation/handler.py`

---
Criado em: 2026-03-30
Última atualização: 2026-03-30
