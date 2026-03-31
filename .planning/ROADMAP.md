# Roadmap — RAG Workforce Bot v2

**Defined:** 2026-03-30
**Granularity:** fine (8-12 phases)
**Total requirements:** 38 (v1)

---

## Phase 1: Localizacao e Strings

**Goal:** Centralizar todas as strings do bot em pt-br com tom profissional cordial em um modulo dedicado, eliminando strings hardcoded dos handlers.
**UI hint:** yes

**Requirements:** L10N-01, L10N-02, L10N-03, L10N-04

**Plan Progress:**
- [x] 01-01: Criar módulo src/bot/strings.py com constantes pt-br — complete (2026-03-30)
- [x] 01-02: Migrar src/bot/templates.py para usar strings.py — complete (2026-03-30)
- [x] 01-03: Migrar src/bot/handlers.py e src/escalation/handler.py para usar strings.py — complete (2026-03-30)
- [x] 01-04: Traduzir perguntas de validacao, system prompts LLM e verificacao final — complete (2026-03-30)

**Success Criteria:**
1. Qualquer mensagem exibida ao usuario — incluindo erros e fallbacks — esta em pt-br sem nenhuma string em ingles visivel.
2. Nenhuma string literal de usuario existe fora de `src/bot/strings.py`; grep por aspas em handlers nao retorna frases de UI.
3. Mensagens de erro exibem tom acolhedor em pt-br ("Algo deu errado, tente novamente ou volte ao menu.") em vez de stack traces ou mensagens genericas.
4. System prompts enviados ao LLM estao em pt-br e as respostas geradas refletem tom profissional cordial.

**Dependencies:** None

---

## Phase 2: Infraestrutura de Teclados e Callbacks

**Goal:** Criar a camada de infra que suporta toda a navegacao por InlineKeyboard — modulo de keyboards, router de callbacks por prefixo, e conformidade com o limite de 64 bytes.
**UI hint:** no

**Requirements:** REF-02, REF-03, NAV-07, NAV-08, NAV-09

**Success Criteria:**
1. Todo `CallbackQueryHandler` no bot chama `await query.answer()` como primeira linha, sem excecoes — nao ha mais spinners infinitos no cliente Telegram.
2. Todos os valores de `callback_data` registrados satisfazem `len(data.encode("utf-8")) <= 64`; um teste unitario verifica isso automaticamente.
3. O router `callback_router.py` despacha callbacks pelo prefixo sem cadeia `if/elif`; adicionar um novo prefixo nao requer tocar em codigo existente.
4. `keyboards.py` expoe funcoes factory para todos os teclados inline existentes; nenhum `InlineKeyboardMarkup` e construido diretamente em handlers.
5. Fluxos de confirmacao existentes (`yes_resolved`, `no_unresolved`) continuam funcionando identicamente apos migracao para o router.

**Dependencies:** Phase 1

---

## Phase 3: Extensao de Estado para Navegacao

**Goal:** Estender `UserConversationState` com os campos de menu necessarios para rastrear posicao na arvore de navegacao sem quebrar o modelo de estado existente.
**UI hint:** no

**Requirements:** NAV-02

**Success Criteria:**
1. `UserConversationState` possui campos `menu_path: list[str]` e `menu_context: dict` e os helpers `push_menu()`, `pop_menu()`, `current_menu()`.
2. Todos os testes de transicao de estado existentes passam sem modificacao — a mudanca e retrocompativel.
3. `edit_message_text` e a atualizacao de estado ocorrem dentro do mesmo bloco `try/except`; nenhuma dessas operacoes e feita de forma descasada.

**Dependencies:** Phase 2

---

## Phase 4: Menu Principal

**Goal:** Implementar o menu principal acessivel via `/start` com InlineKeyboard e garantir que o usuario nunca precise digitar para iniciar uma acao.
**UI hint:** yes

**Requirements:** NAV-01, NAV-04, NAV-05, NAV-06

**Success Criteria:**
1. `/start` exibe imediatamente um menu inline com as opcoes principais (Tirar Duvida, Reportar Erro, Acompanhar Chamado, Falar com Humano) — sem texto de boas-vindas que exija leitura de instrucoes.
2. O botao "Menu Principal" reaparece em qualquer nivel da arvore de navegacao e retorna o usuario ao estado inicial com uma unica interacao.
3. Breadcrumb textual aparece no cabecalho de cada mensagem de menu (ex: `Suporte Workforce > Tirar Duvida`).
4. Texto livre enviado fora de um fluxo ativo exibe o menu principal em vez de uma mensagem de erro ou "comando desconhecido".

**Dependencies:** Phase 3

---

## Phase 5: Arvore Completa de Navegacao

**Goal:** Implementar toda a arvore de submenus com botao Voltar em cada nivel, conectando as entradas do menu principal aos fluxos existentes.
**UI hint:** yes

**Requirements:** NAV-03

**Success Criteria:**
1. Cada nivel de submenu nao-root exibe um botao "Voltar" que retorna ao nivel pai correto com uma unica interacao.
2. A navegacao completa da arvore (raiz → folha → raiz) e possivel exclusivamente por botoes, sem necessidade de digitar qualquer comando.
3. Nenhuma navegacao envia uma nova mensagem ao chat; toda transicao usa `edit_message_text` sobre a mensagem existente.

**Dependencies:** Phase 4

---

## Phase 6: Fluxo Guiado de Report de Erro

**Goal:** Implementar o fluxo completo de coleta de report de erro via botoes inline, com confirmacao antes de submeter e suporte a screenshot.
**UI hint:** yes

**Requirements:** RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, RPT-08, RPT-09, RPT-10, RPT-11

**Success Criteria:**
1. Um usuario consegue reportar um erro completo (area, sintoma, quando, frequencia, confirmacao) sem digitar nenhum texto obrigatorio — apenas tocando em botoes.
2. A tela de confirmacao exibe todos os dados coletados antes de submeter; o usuario pode voltar e corrigir qualquer passo.
3. Apos confirmacao, um ID unico do report e exibido na mensagem de confirmacao.
4. Quando o usuario vem de um artigo da KB que nao resolveu, o campo de categoria do report vem pre-preenchido com a categoria daquele artigo.
5. Antes de criar um ticket novo, o sistema detecta via BM25 se existe um report similar e oferece o resultado ao usuario ("Isso resolve seu problema?").
6. O usuario pode anexar uma screenshot ou foto durante o fluxo; o report e salvo com o attachment.

**Dependencies:** Phase 5

---

## Phase 7: Knowledge Base Navegavel

**Goal:** Tornar a knowledge base navegavel por categorias via botoes inline, com artigos formatados, prompt de resolucao e artigos relacionados.
**UI hint:** yes

**Requirements:** KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, KB-07, KB-08

**Success Criteria:**
1. O usuario navega pelas categorias da KB e chega a um artigo sem digitar nada — apenas por botoes inline.
2. Artigos longos exibem titulo e resumo (max 300 chars) com botao "Ver mais"; artigos curtos exibem conteudo completo.
3. Apos exibir um artigo, o prompt "Isso resolveu?" aparece com opcoes Sim/Nao; "Nao" redireciona para o fluxo de report com categoria pre-preenchida.
4. Artigos dentro de uma categoria sao exibidos em ordem decrescente de acessos.
5. Apos exibir um artigo, ate 3 artigos relacionados sao sugeridos como "Veja tambem".
6. O usuario consegue avaliar um artigo com thumbs-up ou thumbs-down; o voto e registrado.
7. O botao "Pesquisar" esta disponivel como fallback em qualquer nivel da KB para busca por palavra-chave.

**Dependencies:** Phase 6

---

## Phase 8: Refatoracao de handle_message()

**Goal:** Decompor o `handle_message()` monolitico em handlers por estado no pacote `state_handlers/`, tornando o codigo extensivel sem aumentar a complexidade ciclomatica.
**UI hint:** no

**Requirements:** REF-01

**Success Criteria:**
1. `handle_message()` e substituido por um dispatcher que delega para um modulo em `src/bot/state_handlers/` por estado — sem logica de negocio no dispatcher em si.
2. Todos os fluxos de conversacao existentes (report, validacao, escalacao) se comportam de forma identica apos a refatoracao — testes de integracao existentes passam sem alteracao.
3. O estado `IDLE` chama `send_menu_for_path()` quando `menu_path` esta preenchido, reapresentando o menu correto ao usuario.

**Dependencies:** Phase 7

---

## Phase 9: Melhorias na Busca

**Goal:** Corrigir os bugs conhecidos na pipeline de busca e melhorar a precisao com stemming pt-br, BM25Plus, e indice FTS no PostgreSQL.
**UI hint:** no

**Requirements:** SRCH-01, SRCH-02, SRCH-03

**Success Criteria:**
1. `RSLPStemmer` e aplicado na tokenizacao de queries e documentos da KB; buscas com variantes morfologicas do mesmo radical retornam os mesmos documentos que a forma base.
2. `BM25Plus` substitui o calculo manual com `df = 1` hardcoded; a precisao em um conjunto de 10+ queries representativas melhora ou permanece igual (sem regressao).
3. Uma coluna `tsvector` com indice GIN e dicionario `portuguese` existe no PostgreSQL; o pre-filtro de candidatos usa `plainto_tsquery('portuguese', $1)` em vez de `ILIKE %term%`.
4. A chamada `_rerank_with_gpt4o` e async-safe — nao bloqueia o event loop.

**Dependencies:** Phase 8

---

## Phase 10: Feedback Inline

**Goal:** Tornar o ciclo de feedback automatico ao final de cada fluxo, com rating por estrelas e comentario opcional via botoes inline.
**UI hint:** yes

**Requirements:** FBK-01, FBK-02, FBK-03

**Success Criteria:**
1. Ao final de qualquer fluxo (report submetido, artigo KB exibido, escalacao concluida), o prompt de feedback aparece automaticamente via InlineKeyboard — sem o usuario precisar usar `/feedback`.
2. O usuario avalia a interacao com 1-5 estrelas tocando em um botao; o rating e registrado no banco.
3. Apos o rating, o bot pergunta "Quer deixar um comentario?" com opcoes Sim/Nao; se Sim, aguarda texto livre antes de fechar o fluxo.
4. O feedback nao bloqueia o usuario — a qualquer momento ele pode ignorar o prompt e iniciar uma nova acao.

**Dependencies:** Phase 9

---

## Summary Table

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Localizacao e Strings | Centralizar todas as strings em pt-br com tom profissional | Complete    | 2026-03-31 |
| 2 | Infraestrutura de Teclados e Callbacks | Criar camada de infra para navegacao InlineKeyboard | Complete    | 2026-03-31 |
| 3 | Extensao de Estado para Navegacao | Estender UserConversationState com campos de menu | Complete    | 2026-03-31 |
| 4 | Menu Principal | Implementar menu principal via /start com InlineKeyboard | Complete    | 2026-03-31 |
| 5 | Arvore Completa de Navegacao | Implementar arvore de submenus com botao Voltar | Complete    | 2026-03-31 |
| 6 | Fluxo Guiado de Report de Erro | Implementar coleta de report por botoes com confirmacao | Complete    | 2026-03-31 |
| 7 | Knowledge Base Navegavel | Tornar KB navegavel por categorias com artigos formatados | Complete    | 2026-03-31 |
| 8 | Refatoracao de handle_message() | Decompor handle_message() em handlers por estado | Complete    | 2026-03-31 |
| 9 | Melhorias na Busca | Corrigir bugs de busca e melhorar precisao com pt-br | Complete    | 2026-03-31 |
| 10 | Feedback Inline | Automatizar ciclo de feedback ao final de cada fluxo | Complete    | 2026-03-31 |

---
*Roadmap created: 2026-03-30*
*Requirements covered: 38/38*
