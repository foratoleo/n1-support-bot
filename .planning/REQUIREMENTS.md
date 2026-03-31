# Requirements: RAG Workforce Bot v2

**Defined:** 2026-03-30
**Core Value:** O usuario do Workforce deve conseguir resolver sua duvida ou reportar um erro de forma rapida e guiada, sem precisar saber comandos ou digitar texto livre para navegar.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Localizacao

- [x] **L10N-01**: Todas as mensagens do bot em pt-br (botoes, prompts, erros, confirmacoes)
- [x] **L10N-02**: System prompts do LLM reescritos em pt-br com tom profissional cordial
- [x] **L10N-03**: Strings centralizadas em modulo dedicado (src/bot/strings.py), nenhuma string hardcoded em handlers
- [x] **L10N-04**: Mensagens de erro e fallback em pt-br com tom acolhedor

### Menu e Navegacao

- [x] **NAV-01**: /start exibe menu principal com InlineKeyboard (Tirar Duvida, Reportar Erro, Acompanhar Chamado, Falar com Humano)
- [x] **NAV-02**: Navegacao por edit-in-place (edit_message_text), nunca enviar mensagem nova por step
- [x] **NAV-03**: Botao "Voltar" em todo nivel nao-root
- [x] **NAV-04**: Botao "Menu Principal" acessivel em qualquer profundidade
- [x] **NAV-05**: Breadcrumb textual no header da mensagem (ex: Inicio > Tirar Duvida > Acesso)
- [x] **NAV-06**: Texto livre fora de fluxo ativo redireciona ao menu principal
- [x] **NAV-07**: callback_query.answer() chamado em todo CallbackQuery handler
- [x] **NAV-08**: Callback data compacto com esquema prefix:path:action respeitando limite 64 bytes
- [x] **NAV-09**: Router de callbacks baseado em prefixo substituindo if/elif monolitico

### Report de Erro Guiado

- [x] **RPT-01**: Fluxo guiado coleta area funcional via botoes inline
- [x] **RPT-02**: Fluxo guiado coleta tipo de sintoma via botoes inline
- [x] **RPT-03**: Fluxo guiado coleta quando comecou via botoes inline (Hoje, Ontem, Ha mais de 2 dias, Nao sei)
- [x] **RPT-04**: Fluxo guiado coleta frequencia via botoes inline (Sempre, As vezes, So uma vez)
- [x] **RPT-05**: Passo opcional para mensagem de erro ou screenshot (texto livre + foto)
- [x] **RPT-06**: Tela de confirmacao mostrando dados coletados antes de submeter
- [x] **RPT-07**: Usuario pode voltar e corrigir qualquer passo antes de confirmar
- [x] **RPT-08**: ID unico do report exibido apos confirmacao
- [x] **RPT-09**: Pre-preenchimento de categoria quando usuario vem da KB
- [x] **RPT-10**: Deteccao de duplicata via BM25 antes de criar ticket ("Isso resolve?")
- [x] **RPT-11**: Suporte a screenshot/foto como anexo no report

### Knowledge Base

- [x] **KB-01**: KB navegavel por categorias com botoes inline (sem digitacao)
- [x] **KB-02**: Artigo exibido com titulo, resumo (max 300 chars) e botao "Ver mais" se longo
- [x] **KB-03**: Apos artigo: prompt inline "Isso resolveu?" com Sim/Nao
- [x] **KB-04**: "Nao resolveu" redireciona para report de erro pre-preenchido com categoria
- [x] **KB-05**: Botao "Pesquisar" disponivel como fallback para busca por keyword
- [x] **KB-06**: "Veja tambem" com 2-3 artigos relacionados apos exibir artigo
- [x] **KB-07**: Artigos ordenados por quantidade de acessos dentro da categoria
- [x] **KB-08**: Rating thumbs-up/thumbs-down por artigo

### Busca

- [ ] **SRCH-01**: Tokenizacao com RSLPStemmer para stemming pt-br
- [ ] **SRCH-02**: Substituir calculo BM25 manual por BM25Plus (rank_bm25) com parametros corretos
- [ ] **SRCH-03**: Indice tsvector/GIN no PostgreSQL com dicionario portuguese para busca full-text

### Refatoracao Estrutural

- [x] **REF-01**: Decompor handle_message() em handlers por estado (src/bot/state_handlers/)
- [x] **REF-02**: Decompor button_callback monolitico em router de callbacks por prefixo
- [x] **REF-03**: Centralizar teclados InlineKeyboard em modulo dedicado (src/bot/keyboards.py)

### Feedback

- [ ] **FBK-01**: Feedback solicitado automaticamente apos fim de fluxo (nao apenas via /feedback)
- [ ] **FBK-02**: Rating 1-5 estrelas via botoes inline
- [ ] **FBK-03**: Comentario opcional apos rating ("Quer deixar um comentario?" Sim/Nao)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Diferenciadores Adiados

- **DIFF-01**: Deteccao primeiro acesso vs retorno com mensagem diferenciada
- **DIFF-02**: Atalho "Retomar chamado recente" no menu principal
- **DIFF-03**: Persistencia de estado no PostgreSQL (sobrevive restart)
- **DIFF-04**: Feedback proativo quando agente fecha ticket (webhook/polling)
- **DIFF-05**: Navigation stack completo para back N niveis (v1 usa parent simples)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Painel admin web | Complexidade alta, sem ganho direto ao usuario neste ciclo |
| Suporte multilingual (en/es) | Foco exclusivo em pt-br, sem demanda atual |
| Integracao WhatsApp/Slack | Telegram only neste milestone |
| Autenticacao de usuarios | Bot aberto, identidade Telegram suficiente |
| Menu com mais de 3 niveis | Anti-feature: usuarios perdem contexto |
| ReplyKeyboardMarkup | Anti-feature: polui area do teclado, nao dismissivel |
| Registro/cadastro obrigatorio | Anti-feature: ferramenta interna, Telegram ID basta |
| Cross-encoder re-ranking local | Complexidade de deploy com modelo ML, adiar |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| L10N-01 | Phase 1 | Complete |
| L10N-02 | Phase 1 | Complete |
| L10N-03 | Phase 1 | Complete |
| L10N-04 | Phase 1 | Complete |
| NAV-01 | Phase 4 | Complete |
| NAV-02 | Phase 3 | Complete |
| NAV-03 | Phase 5 | Complete |
| NAV-04 | Phase 4 | Complete |
| NAV-05 | Phase 4 | Complete |
| NAV-06 | Phase 4 | Complete |
| NAV-07 | Phase 2 | Complete |
| NAV-08 | Phase 2 | Complete |
| NAV-09 | Phase 2 | Complete |
| RPT-01 | Phase 6 | Complete |
| RPT-02 | Phase 6 | Complete |
| RPT-03 | Phase 6 | Complete |
| RPT-04 | Phase 6 | Complete |
| RPT-05 | Phase 6 | Complete |
| RPT-06 | Phase 6 | Complete |
| RPT-07 | Phase 6 | Complete |
| RPT-08 | Phase 6 | Complete |
| RPT-09 | Phase 6 | Complete |
| RPT-10 | Phase 6 | Complete |
| RPT-11 | Phase 6 | Complete |
| KB-01 | Phase 7 | Complete |
| KB-02 | Phase 7 | Complete |
| KB-03 | Phase 7 | Complete |
| KB-04 | Phase 7 | Complete |
| KB-05 | Phase 7 | Complete |
| KB-06 | Phase 7 | Complete |
| KB-07 | Phase 7 | Complete |
| KB-08 | Phase 7 | Complete |
| SRCH-01 | Phase 9 | Pending |
| SRCH-02 | Phase 9 | Pending |
| SRCH-03 | Phase 9 | Pending |
| REF-01 | Phase 8 | Complete |
| REF-02 | Phase 2 | Complete |
| REF-03 | Phase 2 | Complete |
| FBK-01 | Phase 10 | Pending |
| FBK-02 | Phase 10 | Pending |
| FBK-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after initial definition*
