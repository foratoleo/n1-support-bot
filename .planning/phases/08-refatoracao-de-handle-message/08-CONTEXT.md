# Fase 8 — Refatoração de handle_message()

Criado em: 2026-03-30
Última atualização: 2026-03-30

## Objetivo

Decompor o método `handle_message()` monolítico em handlers por estado no pacote `src/bot/state_handlers/`, tornando o código extensível sem aumentar a complexidade ciclomática.

## Requisito

REF-01 — Decomposição de handlers por estado de conversa.

## Critérios de Sucesso

1. `handle_message()` substituído por dispatcher que delega para módulo em `src/bot/state_handlers/` por estado — sem lógica de negócio no dispatcher.
2. Todos os fluxos de conversação existentes se comportam de forma idêntica após refatoração — testes existentes passam sem alteração.
3. Estado IDLE chama `send_menu_for_path()` quando `menu_path` está preenchido, reapresentando o menu correto.

## Arquivos Principais

- `src/bot/handlers.py` — dispatcher simplificado (~15 linhas em `handle_message`)
- `src/bot/state_handlers/__init__.py` — dicionário `DISPATCHER` e função `dispatch`
- `src/bot/state_handlers/idle.py` — estado IDLE com suporte a `menu_path`
- `src/bot/state_handlers/awaiting_validation.py` — estado AWAITING_VALIDATION_ANSWER
- `src/bot/state_handlers/providing_guidance.py` — estado PROVIDING_GUIDANCE
- `src/bot/state_handlers/escalated.py` — estado ESCALATED
- `src/bot/state_handlers/collecting_report.py` — estado COLLECTING_REPORT (RPT-05)
- `src/bot/state_handlers/awaiting_kb_search.py` — estado AWAITING_KB_SEARCH (KB-07)
- `src/bot/state_handlers/awaiting_report.py` — estado AWAITING_REPORT (fallback)

## Decisões de Arquitetura

- Cada handler recebe `(update, context, user_state, conv_manager)` como assinatura uniforme.
- O dispatcher em `__init__.py` usa um dicionário `DISPATCHER` keyed por `ConversationState`.
- O null-check para mensagens não-texto permanece no `handle_message()` do `handlers.py`, antes da delegação, pois é uma guarda de infraestrutura e não lógica de estado.
- O estado `COLLECTING_REPORT` ainda é despachado antes do null-check porque aceita fotos (RPT-05).
- A função `_handle_kb_search_message` foi removida de `handlers.py` e seu conteúdo migrado integralmente para `awaiting_kb_search.py`.
