# Fase 3 — Plano 03-01: Extensão de Estado para Navegação — Resumo

**Criado:** 2026-03-30
**Última atualização:** 2026-03-30
**Status:** complete

---

## O que foi feito

Extensão de `UserConversationState` e `ConversationManager` em
`src/bot/conversation_manager.py` para suportar navegação por menu inline.

### Campos adicionados a `UserConversationState`

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `menu_path` | `List[str]` | `[]` | Pilha de nós do menu ativos (ex.: `["main", "duvidas"]`) |
| `menu_context` | `Dict[str, Any]` | `{}` | Contexto transitório do nó atual |

### Métodos adicionados a `UserConversationState`

| Método | Assinatura | Comportamento |
|--------|-----------|---------------|
| `push_menu` | `(path: str, context: dict = None) -> None` | Empurra nó na pilha; substitui `menu_context` se `context` fornecido |
| `pop_menu` | `() -> Optional[str]` | Remove e retorna o nó mais recente; não remove o elemento raiz |
| `current_menu` | `() -> Optional[str]` | Retorna o nó mais recente sem alterar a pilha |
| `clear_menu` | `() -> None` | Reinicia `menu_path` e `menu_context` para vazios |

### Atualizações em `ConversationManager`

- `clear_user_state()` agora também zera `menu_path` e `menu_context`
- Novo método assíncrono `edit_message_and_update_state()`: executa
  `query.edit_message_text()` e `update_user_state()` no mesmo bloco
  `try/except`, garantindo atomicidade entre edição de mensagem e mudança
  de estado

## Critérios de aceite verificados

1. `UserConversationState` possui `menu_path`, `menu_context` e os quatro helpers — **atendido**
2. Os 26 testes de transição de estado existentes passam sem modificação — **atendido** (26/26)
3. `edit_message_text` e atualização de estado ocorrem no mesmo bloco `try/except` — **atendido** via `edit_message_and_update_state`

## Compatibilidade retroativa

Todo código existente que instancia `UserConversationState(state=..., user_id=...)`
continua funcionando sem alteração, pois ambos os novos campos têm
`default_factory=list` / `default_factory=dict`.
