# Fase 4 — Menu Principal: Contexto de Execução

**Criado em:** 2026-03-30
**Última atualização:** 2026-03-30

## Objetivo

Implementar o menu principal acessível via /start com InlineKeyboard, garantindo que o usuário
nunca precise digitar para iniciar uma ação.

## Requisitos Atendidos

| ID     | Descrição                                                                 | Status   |
|--------|---------------------------------------------------------------------------|----------|
| NAV-01 | /start exibe menu inline imediatamente, sem instruções textuais           | Completo |
| NAV-04 | Botão "Menu Principal" retorna ao estado inicial em qualquer nível        | Completo |
| NAV-05 | Breadcrumb textual no cabeçalho de cada mensagem de submenu               | Completo |
| NAV-06 | Texto livre fora de fluxo ativo exibe o menu principal em vez de erro     | Completo |

## Arquivos Modificados

- `src/bot/strings.py` — Adição de constantes de menu (MENU_WELCOME, BTN_*, BREADCRUMB_ROOT, FREE_TEXT_REDIRECT, placeholders)
- `src/bot/keyboards.py` — Implementação de get_main_menu_keyboard(), get_back_to_menu_keyboard(), format_breadcrumb()
- `src/bot/handlers.py` — start_command() e handle_message() atualizados para usar menu
- `src/bot/_callback_handlers.py` — Handler menu: registrado com sub-handlers para duvidas/erro/chamado/humano/main

## Decisões Técnicas

- Grade 2x2 para os 4 botões principais (melhor ergonomia mobile)
- Callback data no formato "menu:<ação>" com prefixo único para roteamento pelo callback_router
- Handlers de submenu como funções privadas (_handle_menu_*) dentro do mesmo arquivo
- format_breadcrumb() aceita *args variádicos e sempre prefixa BREADCRUMB_ROOT
- Submenus duvidas/erro são placeholders — serão implementados nas fases 5 e 7
- menu:chamado busca o chamado mais recente sem exigir input do usuário
- menu:humano cria escalação somente se existir current_report_id; caso contrário orienta o usuário
