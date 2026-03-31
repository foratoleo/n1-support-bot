# Fase 5 - Árvore Completa de Navegação

**Criado em:** 2026-03-30
**Última atualização:** 2026-03-30

## Objetivo

Implementar toda a árvore de submenus com botão Voltar em cada nível, conectando as entradas do menu principal aos fluxos existentes.

## Requisito

NAV-03

## Critérios de Sucesso

1. Cada nível de submenu não-root exibe um botão "Voltar" que retorna ao nível pai correto.
2. Navegação completa da árvore (raiz → folha → raiz) é possível exclusivamente por botões.
3. Nenhuma navegação envia uma nova mensagem ao chat; toda transição usa edit_message_text.

## Arquivos Modificados

- `src/bot/strings.py` — novas strings de navegação (BTN_VOLTAR, BTN_CAT_*, SUBMENU_ESCOLHA, textos de submenu)
- `src/bot/keyboards.py` — novos teclados (get_duvidas_submenu_keyboard, get_erro_submenu_keyboard, get_category_keyboard)
- `src/bot/_callback_handlers.py` — handler nav: com nav:back, atualização de menu:duvidas e menu:erro, handlers de categoria

## Árvore de Navegação Implementada

```
menu:main (raiz)
├── menu:duvidas → get_duvidas_submenu_keyboard
│   ├── menu:duvidas:acesso → get_category_keyboard
│   ├── menu:duvidas:documentos → get_category_keyboard
│   ├── menu:duvidas:tarefas → get_category_keyboard
│   └── menu:duvidas:geral → get_category_keyboard
├── menu:erro → get_erro_submenu_keyboard (placeholder Fase 6)
├── menu:chamado → get_back_to_menu_keyboard
└── menu:humano → get_back_to_menu_keyboard
```

## Callbacks Registrados

| Callback | Handler | Ação |
|---|---|---|
| nav:back | handle_nav_callback | pop_menu + re-render nível pai |
| menu:duvidas | handle_menu_callback | push_menu("duvidas") + submenu |
| menu:duvidas:acesso | handle_menu_callback | push_menu + conteúdo categoria |
| menu:duvidas:documentos | handle_menu_callback | push_menu + conteúdo categoria |
| menu:duvidas:tarefas | handle_menu_callback | push_menu + conteúdo categoria |
| menu:duvidas:geral | handle_menu_callback | push_menu + conteúdo categoria |
| menu:erro | handle_menu_callback | push_menu("erro") + submenu erro |

## Notas Técnicas

- Todos os callback_data estão dentro do limite de 64 bytes UTF-8.
- Toda transição de menu usa `edit_message_text`; nenhuma nova mensagem é enviada.
- O estado de navegação é mantido via `push_menu`/`pop_menu` em `UserConversationState.menu_path`.
- O handler `nav:back` usa `current_menu()` após `pop_menu()` para determinar o nível pai e renderizar o teclado correto.
