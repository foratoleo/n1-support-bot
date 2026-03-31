# Fase 3 — Extensão de Estado para Navegação: Contexto

**Criado:** 2026-03-30
**Última atualização:** 2026-03-30
**Requisito:** NAV-02

---

## Objetivo

Estender `UserConversationState` com campos e helpers de navegação por menu,
sem quebrar o modelo de estado existente do fluxo de report/validação.

## Decisões de implementação

| Decisão | Justificativa |
|---------|---------------|
| `menu_path` e `menu_context` como campos do dataclass com `default_factory` | Compatibilidade retroativa total — código que cria `UserConversationState` sem esses campos continua funcionando |
| Helpers (`push_menu`, `pop_menu`, `current_menu`, `clear_menu`) como métodos da instância | Encapsulam a lógica de navegação no próprio objeto de estado, sem dependências externas |
| `edit_message_and_update_state` em `ConversationManager` | Garante que edição de mensagem Telegram e mudança de estado sejam tratadas no mesmo `try/except`, evitando estado inconsistente em caso de falha de rede |
| `pop_menu` não remove o elemento raiz | Impede navegação além da raiz; retorna o nó raiz sem removê-lo |

## Arquivos modificados

- `src/bot/conversation_manager.py` — único arquivo alterado

## Resultado de testes

- 26/26 testes de `test_conversation_manager.py` passam sem modificação
- 15 falhas pré-existentes em outros módulos (circular imports, string mismatches de fases anteriores) permanecem inalteradas
