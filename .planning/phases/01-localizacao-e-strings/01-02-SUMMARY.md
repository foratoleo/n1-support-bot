---
phase: 1
plan: 2
title: "Migrar src/bot/templates.py para usar strings.py"
status: complete
completed_at: "2026-03-30"
---

# Resumo — Plano 01-02

## O que foi feito

Migração completa de `src/bot/templates.py` para importar todas as strings user-facing de `src.bot.strings`, eliminando strings hardcoded em inglês do arquivo.

## Tasks executadas

### Task 1 — Substituir BOT_MESSAGES e defaults hardcoded

- Adicionado `from src.bot import strings` no topo do arquivo.
- `BOT_MESSAGES` mantido como alias de compatibilidade mapeando as 15 chaves originais para constantes de `strings.py`.
- `format_escalation()` — defaults `project` e `impact` substituídos por `strings.DEFAULT_PROJECT_NOT_SPECIFIED` e `strings.DEFAULT_IMPACT_UNDETERMINED`.
- `format_status_report()` — `"Yes"` e `"No"` substituídos por `strings.STATUS_ESCALATED_YES` e `strings.STATUS_ESCALATED_NO`.
- `format_search_results()` — template inline substituído por `strings.SEARCH_RESULT_ITEM.format(...)`.
- `get_confirmation_keyboard()` — labels `"Yes, resolved"` e `"No, still need help"` substituídos por `strings.BTN_YES_RESOLVED` e `strings.BTN_NO_UNRESOLVED`.
- `format_report_list()` — label `"Rating:"` traduzido para `"Avaliação:"`.

### Task 2 — Verificação das funções públicas

Todas as chamadas validadas com sucesso:

- `format_acknowledge("x")` retorna string contendo "Recebi".
- `format_escalation("r", "issue")` retorna "Não informado" e "A determinar" (defaults pt-br).
- `format_status_report(..., escalated=True)` retorna "Sim", não "Yes".
- `format_status_report(..., escalated=False)` retorna "Não", não "No".
- `get_confirmation_keyboard()` retorna botões `['Sim, resolveu', 'Não, ainda preciso de ajuda']`.

## Arquivo modificado

- `src/bot/templates.py` — 66 linhas removidas, 32 adicionadas (net: -34)

## Commit

`36b50db` — feat(strings): migrate templates.py to import all strings from strings.py

## Critérios de aceitação

Todos atendidos:

- Zero strings em inglês user-facing em `templates.py`.
- `from src.bot import strings` presente.
- `strings.BTN_YES_RESOLVED` e `strings.BTN_NO_UNRESOLVED` nos botões.
- `strings.STATUS_ESCALATED_YES` / `strings.STATUS_ESCALATED_NO` em `format_status_report`.
- `strings.DEFAULT_PROJECT_NOT_SPECIFIED` / `strings.DEFAULT_IMPACT_UNDETERMINED` em `format_escalation`.
- `strings.SEARCH_RESULT_ITEM` em `format_search_results`.
- Import sem erros com `from src.bot.templates import BOT_MESSAGES`.

---

Criado em: 2026-03-30
Última atualização: 2026-03-30
