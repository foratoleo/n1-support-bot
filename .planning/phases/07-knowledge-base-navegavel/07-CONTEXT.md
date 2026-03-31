# Phase 7 — Knowledge Base Navegável: Contexto

Criado em: 2026-03-30
Última atualização: 2026-03-30

## Objetivo

Tornar a base de conhecimento navegável por categorias via botões inline, com artigos formatados, prompt de resolução e artigos relacionados (requisitos KB-01 a KB-08).

## Escopo

### Requisitos implementados

- KB-01: Listagem de categorias via InlineKeyboard
- KB-02: Listagem de artigos dentro de categoria com botões inline
- KB-03: Resumo truncado (300 chars) com botão "Ver artigo completo"
- KB-04: Prompt "Isso resolveu sua dúvida?" com Sim/Não
- KB-05: "Não" redireciona para wizard de report com categoria pré-preenchida
- KB-06: Artigos ordenados por acessos decrescentes
- KB-07: Até 3 artigos relacionados ("Veja também") + fallback de busca por keyword
- KB-08: Thumbs-up/thumbs-down por artigo

## Arquivos modificados

- `src/bot/strings.py` — Novas strings KB_BROWSE_TITLE, KB_CATEGORY_HEADER, KB_ARTICLE_SUMMARY, BTN_VER_MAIS, KB_RESOLVED_PROMPT, BTN_SIM_RESOLVEU, BTN_NAO_RESOLVEU, KB_VEJA_TAMBEM, BTN_PESQUISAR, KB_SEARCH_PROMPT, BTN_THUMB_UP, BTN_THUMB_DOWN, KB_RATING_THANKS e demais strings de KB
- `src/bot/keyboards.py` — Novas factories: get_kb_category_list_keyboard, get_kb_article_list_keyboard, get_kb_article_keyboard, get_kb_ver_mais_keyboard
- `src/bot/conversation_manager.py` — Novo estado AWAITING_KB_SEARCH
- `src/bot/kb_browser.py` — Novo módulo com handler kb: e todos os sub-handlers
- `src/bot/callback_router.py` — Import de kb_browser para registro do handler
- `src/bot/_callback_handlers.py` — menu:duvidas atualizado para usar get_kb_category_list_keyboard; nav:back atualizado para tratar nós kb:cat:*
- `src/bot/handlers.py` — handle_message atualizado para tratar AWAITING_KB_SEARCH; nova função _handle_kb_search_message

## Decisoes tecnicas

### Armazenamento de acessos e ratings
Implementados como dicionários em memória por simplicidade. Em producao esses dados deveriam ser persistidos na tabela rag.kb_documents com campos access_count e rating_up/rating_dn.

### Callback data e limite de 64 bytes
Todos os callbacks foram validados — o maior é kb:unresolved:{uuid} com 50 bytes, dentro do limite.

### Relacao entre categoria de menu e area no banco
Mapeamento explícito: acesso→login_auth, documentos→document_generation, tarefas→task_sprint, geral→general. Alinha com o classificador existente em knowledge_base.py.
