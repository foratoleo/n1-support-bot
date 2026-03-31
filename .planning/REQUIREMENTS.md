# Requirements: RAG Workforce Bot v2

**Defined:** 2026-03-30
**Core Value:** O usuario do Workforce deve conseguir resolver sua duvida ou reportar um erro de forma rapida e guiada, sem precisar saber comandos ou digitar texto livre para navegar.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Localizacao

- [ ] **L10N-01**: Todas as mensagens do bot em pt-br (botoes, prompts, erros, confirmacoes)
- [ ] **L10N-02**: System prompts do LLM reescritos em pt-br com tom profissional cordial
- [ ] **L10N-03**: Strings centralizadas em modulo dedicado (src/bot/strings.py), nenhuma string hardcoded em handlers
- [ ] **L10N-04**: Mensagens de erro e fallback em pt-br com tom acolhedor

### Menu e Navegacao

- [ ] **NAV-01**: /start exibe menu principal com InlineKeyboard (Tirar Duvida, Reportar Erro, Acompanhar Chamado, Falar com Humano)
- [ ] **NAV-02**: Navegacao por edit-in-place (edit_message_text), nunca enviar mensagem nova por step
- [ ] **NAV-03**: Botao "Voltar" em todo nivel nao-root
- [ ] **NAV-04**: Botao "Menu Principal" acessivel em qualquer profundidade
- [ ] **NAV-05**: Breadcrumb textual no header da mensagem (ex: Inicio > Tirar Duvida > Acesso)
- [ ] **NAV-06**: Texto livre fora de fluxo ativo redireciona ao menu principal
- [ ] **NAV-07**: callback_query.answer() chamado em todo CallbackQuery handler
- [ ] **NAV-08**: Callback data compacto com esquema prefix:path:action respeitando limite 64 bytes
- [ ] **NAV-09**: Router de callbacks baseado em prefixo substituindo if/elif monolitico

### Report de Erro Guiado

- [ ] **RPT-01**: Fluxo guiado coleta area funcional via botoes inline
- [ ] **RPT-02**: Fluxo guiado coleta tipo de sintoma via botoes inline
- [ ] **RPT-03**: Fluxo guiado coleta quando comecou via botoes inline (Hoje, Ontem, Ha mais de 2 dias, Nao sei)
- [ ] **RPT-04**: Fluxo guiado coleta frequencia via botoes inline (Sempre, As vezes, So uma vez)
- [ ] **RPT-05**: Passo opcional para mensagem de erro ou screenshot (texto livre + foto)
- [ ] **RPT-06**: Tela de confirmacao mostrando dados coletados antes de submeter
- [ ] **RPT-07**: Usuario pode voltar e corrigir qualquer passo antes de confirmar
- [ ] **RPT-08**: ID unico do report exibido apos confirmacao
- [ ] **RPT-09**: Pre-preenchimento de categoria quando usuario vem da KB
- [ ] **RPT-10**: Deteccao de duplicata via BM25 antes de criar ticket ("Isso resolve?")
- [ ] **RPT-11**: Suporte a screenshot/foto como anexo no report

### Knowledge Base

- [ ] **KB-01**: KB navegavel por categorias com botoes inline (sem digitacao)
- [ ] **KB-02**: Artigo exibido com titulo, resumo (max 300 chars) e botao "Ver mais" se longo
- [ ] **KB-03**: Apos artigo: prompt inline "Isso resolveu?" com Sim/Nao
- [ ] **KB-04**: "Nao resolveu" redireciona para report de erro pre-preenchido com categoria
- [ ] **KB-05**: Botao "Pesquisar" disponivel como fallback para busca por keyword
- [ ] **KB-06**: "Veja tambem" com 2-3 artigos relacionados apos exibir artigo
- [ ] **KB-07**: Artigos ordenados por quantidade de acessos dentro da categoria
- [ ] **KB-08**: Rating thumbs-up/thumbs-down por artigo

### Busca

- [ ] **SRCH-01**: Tokenizacao com RSLPStemmer para stemming pt-br
- [ ] **SRCH-02**: Substituir calculo BM25 manual por BM25Plus (rank_bm25) com parametros corretos
- [ ] **SRCH-03**: Indice tsvector/GIN no PostgreSQL com dicionario portuguese para busca full-text

### Refatoracao Estrutural

- [ ] **REF-01**: Decompor handle_message() em handlers por estado (src/bot/state_handlers/)
- [ ] **REF-02**: Decompor button_callback monolitico em router de callbacks por prefixo
- [ ] **REF-03**: Centralizar teclados InlineKeyboard em modulo dedicado (src/bot/keyboards.py)

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
| L10N-01 | Pending | Pending |
| L10N-02 | Pending | Pending |
| L10N-03 | Pending | Pending |
| L10N-04 | Pending | Pending |
| NAV-01 | Pending | Pending |
| NAV-02 | Pending | Pending |
| NAV-03 | Pending | Pending |
| NAV-04 | Pending | Pending |
| NAV-05 | Pending | Pending |
| NAV-06 | Pending | Pending |
| NAV-07 | Pending | Pending |
| NAV-08 | Pending | Pending |
| NAV-09 | Pending | Pending |
| RPT-01 | Pending | Pending |
| RPT-02 | Pending | Pending |
| RPT-03 | Pending | Pending |
| RPT-04 | Pending | Pending |
| RPT-05 | Pending | Pending |
| RPT-06 | Pending | Pending |
| RPT-07 | Pending | Pending |
| RPT-08 | Pending | Pending |
| RPT-09 | Pending | Pending |
| RPT-10 | Pending | Pending |
| RPT-11 | Pending | Pending |
| KB-01 | Pending | Pending |
| KB-02 | Pending | Pending |
| KB-03 | Pending | Pending |
| KB-04 | Pending | Pending |
| KB-05 | Pending | Pending |
| KB-06 | Pending | Pending |
| KB-07 | Pending | Pending |
| KB-08 | Pending | Pending |
| SRCH-01 | Pending | Pending |
| SRCH-02 | Pending | Pending |
| SRCH-03 | Pending | Pending |
| REF-01 | Pending | Pending |
| REF-02 | Pending | Pending |
| REF-03 | Pending | Pending |
| FBK-01 | Pending | Pending |
| FBK-02 | Pending | Pending |
| FBK-03 | Pending | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 0
- Unmapped: 38

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after initial definition*
