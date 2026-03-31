---
phase: 1
plan: 1
title: "Criar módulo src/bot/strings.py com todas as constantes pt-br"
status: complete
created_at: 2026-03-30
updated_at: 2026-03-30
---

# Resumo de Execução — Plano 01-01

## O que foi feito

Criado o arquivo `src/bot/strings.py` com 48 constantes UPPER_SNAKE_CASE em pt-br, centralizando todas as strings voltadas ao usuário do bot de suporte N1 do Workforce.

## Arquivos criados

- `src/bot/strings.py` — módulo de strings centralizadas (241 linhas, 48 constantes)

## Inventário das strings levantadas

Antes da criação do módulo, foram lidos e inventariados:

- `src/bot/templates.py` — `BOT_MESSAGES` dict com 15 chaves em inglês, labels de botões inline em inglês ("Yes, resolved", "No, still need help")
- `src/bot/handlers.py` — strings hardcoded em inglês em `report_command`, `status_command`, `handle_message`, `search_command`, `list_command`, `feedback_command`, `button_callback`
- `src/escalation/handler.py` — strings em inglês em `format_escalation_message` e `format_self_service_message` (defaults "Not specified", "To be determined", mensagens compostas em inglês)

## Constantes criadas por categoria

| Categoria | Constantes |
|-----------|-----------|
| Comandos básicos | WELCOME, HELP, CANCEL, ERROR_GENERIC |
| Idle / redirecionamento | IDLE_REDIRECT, NON_TEXT_MESSAGE |
| Fluxo de report | REPORT_MISSING_ARGS, REPORT_ACKNOWLEDGED, VALIDATION_QUESTION, VALIDATION_ANALYZING |
| Orientação por KB | SELF_SERVICE_GUIDANCE, CONFIRMATION_QUESTION |
| Escalação | ESCALATION_MESSAGE, ESCALATION_WORKAROUNDS_HEADER, ESCALATION_KNOWN_ISSUES_TIP, ESCALATED_STATE_MESSAGE, ESCALATION_SELF_SERVICE_INTRO, ESCALATION_STEPS_HEADER, ESCALATION_NOT_RESOLVED_FOLLOWUP |
| Callbacks inline | CALLBACK_RESOLVED, CALLBACK_NOT_RESOLVED, CALLBACK_ESCALATION_SUMMARY |
| Botões inline | BTN_YES_RESOLVED, BTN_NO_UNRESOLVED |
| Status de chamado | STATUS_REPORT, STATUS_ESCALATED_YES, STATUS_ESCALATED_NO, STATUS_MISSING_ARGS, STATUS_INVALID_ID, STATUS_NOT_FOUND |
| Busca | SEARCH_MISSING_ARGS, SEARCH_RESULTS, SEARCH_NO_RESULTS, SEARCH_RESULT_ITEM |
| Lista de chamados | LIST_NO_REPORTS, LIST_HEADER, LIST_ITEM, LIST_INVALID_USER |
| Feedback | FEEDBACK_MISSING_ARGS, FEEDBACK_INVALID_RATING, FEEDBACK_INVALID_ID, FEEDBACK_NOT_FOUND, FEEDBACK_SUCCESS |
| Defaults internos | DEFAULT_PROJECT_NOT_SPECIFIED, DEFAULT_IMPACT_UNDETERMINED, DEFAULT_SELF_SERVICE_STEP, DEFAULT_ESCALATION_SUMMARY, DEFAULT_ISSUE_DESCRIPTION |

## Verificações executadas

- 48 constantes confirmadas via `importlib` (critério: 40+)
- Nenhuma string em inglês voltada ao usuário (grep retornou vazio)
- Strings pt-br presentes: "Olá!", "Recebi", "Analisei", "Obrigado", "Você será", "Chamado requer", "Sim, resolveu", "Não, ainda preciso de ajuda"
- Arquivo importa sem erros e sem dependências externas

## Commit

`9f77200` — feat(strings): criar módulo src/bot/strings.py com constantes pt-br
