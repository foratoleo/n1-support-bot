# Fase 4 — Plano 04-01: Sumário de Execução

**Criado em:** 2026-03-30
**Última atualização:** 2026-03-30
**Status:** Completo

## O que foi feito

### 1. Strings centralizadas (strings.py)

Adicionadas 11 novas constantes ao final do arquivo:
- MENU_WELCOME, BTN_TIRAR_DUVIDA, BTN_REPORTAR_ERRO, BTN_ACOMPANHAR_CHAMADO, BTN_FALAR_HUMANO
- BTN_MENU_PRINCIPAL, BREADCRUMB_ROOT, FREE_TEXT_REDIRECT
- MENU_PLACEHOLDER_DUVIDAS, MENU_PLACEHOLDER_ERRO, MENU_HUMANO_INICIANDO

### 2. Teclados (keyboards.py)

- format_breadcrumb(*path_parts) — helper que prefixa BREADCRUMB_ROOT com separador " > "
- get_main_menu_keyboard() — grade 2x2 com callback_data "menu:duvidas", "menu:erro", "menu:chamado", "menu:humano"
- get_back_to_menu_keyboard() — botão único "Menu Principal" com callback_data "menu:main"

### 3. Handlers (handlers.py)

- start_command(): limpa estado do usuário e envia MENU_WELCOME + get_main_menu_keyboard()
- handle_message() IDLE: substituída mensagem de texto por MENU_WELCOME + menu (NAV-06)

### 4. Callbacks de menu (_callback_handlers.py)

- @register("menu:") despacha para _handle_menu_* por sufixo
- _handle_menu_main: edita mensagem para o menu raiz (NAV-04)
- _handle_menu_duvidas: placeholder com breadcrumb + botão voltar
- _handle_menu_erro: placeholder com breadcrumb + botão voltar
- _handle_menu_chamado: busca chamado mais recente, exibe status com breadcrumb
- _handle_menu_humano: cria escalação se existir chamado ativo, orienta caso contrário

## Critérios de Aceite Verificados

1. /start exibe menu inline imediatamente — SIM (start_command revisado)
2. Botão "Menu Principal" em qualquer nível retorna ao raiz — SIM (menu:main + edit_message_text)
3. Breadcrumb no cabeçalho de cada submenu — SIM (format_breadcrumb() em todos os handlers)
4. Texto livre em IDLE exibe menu em vez de erro — SIM (handle_message IDLE revisado)
