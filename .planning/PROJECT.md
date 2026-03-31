# RAG Workforce Bot - Melhoria v2

## What This Is

Bot de suporte N1 no Telegram para usuários da ferramenta Workforce. Recebe dúvidas e reportes de erro, busca na knowledge base usando BM25 + embeddings, classifica issues e orienta o usuário ou escalona para suporte humano. A v2 foca em traduzir toda a experiência para pt-br, implementar navegação guiada por menus inline e melhorar a qualidade das respostas e da busca.

## Core Value

O usuário do Workforce deve conseguir resolver sua dúvida ou reportar um erro de forma rápida e guiada, sem precisar saber comandos ou digitar texto livre para navegar.

## Requirements

### Validated

- User can report issues via Telegram bot -- existing
- Bot searches knowledge base using BM25 ranking -- existing
- Bot classifies issues and decides escalation vs self-service -- existing
- Bot collects user feedback after interactions -- existing
- Hybrid search with BM25 + vector embeddings -- existing
- Commands /search, /list, /feedback with inline keyboard confirmations -- existing
- PostgreSQL with async driver (asyncpg + SQLAlchemy) -- existing
- Docker Compose deployment with 5 services -- existing

### Active

- [ ] Toda interface do bot em pt-br (mensagens, botões, prompts, erros)
- [ ] Menu principal ao iniciar conversa (Tirar Dúvidas / Reportar Erro / etc.)
- [ ] Árvore completa de submenus com navegação por InlineKeyboard
- [ ] Submenu "Tirar Dúvidas" com categorias da KB
- [ ] Submenu "Reportar Erro" com fluxo guiado de coleta de informações
- [ ] Botão "Voltar" em todos os níveis de submenu
- [ ] Tom profissional cordial em todas as respostas do bot
- [ ] Melhorar qualidade das respostas geradas pelo LLM (mais contextuais e específicas)
- [ ] Melhorar precisão da busca na KB (ranking, relevância, fallbacks)
- [ ] Prompts do LLM otimizados para pt-br

### Out of Scope

- Painel admin web -- complexidade alta, não é prioridade neste ciclo
- Suporte multilíngue (en/es) -- foco exclusivo em pt-br
- Integração com outros canais (WhatsApp, Slack) -- Telegram only
- Autenticação de usuários -- bot aberto para quem tiver o link

## Context

- Bot existente funcional em inglês, com ~3.500 linhas de código
- Stack: Python 3.11+, python-telegram-bot 21.7, PostgreSQL, OpenAI API (MiniMax-M2)
- Arquitetura monolítica em camadas (presentation → business → RAG → data)
- Repository pattern para acesso a dados, async/await throughout
- Codebase mapeado em `.planning/codebase/` com 7 documentos de referência
- Concerns identificados: handler principal com 200+ linhas, estado em memória, cache BM25 sem invalidação
- Usuários: funcionários que usam a ferramenta Workforce no dia a dia
- Objetivo: experiência guiada onde o usuário navega por botões, não digita comandos

## Constraints

- **Tech stack**: Manter Python + python-telegram-bot + PostgreSQL (não trocar stack)
- **Backward compatibility**: Não quebrar funcionalidades existentes (search, feedback, escalation)
- **LLM provider**: Manter OpenAI-compatible API (MiniMax-M2 configurado)
- **Deployment**: Manter Docker Compose como método de deploy

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| InlineKeyboard para navegação | Experiência guiada sem digitação, padrão Telegram | -- Pending |
| Tom profissional cordial | Alinhado com suporte corporativo para ferramenta interna | -- Pending |
| pt-br como único idioma | Foco no público-alvo, simplifica prompts e UX | -- Pending |
| Melhoria preventiva na busca | Sem problemas conhecidos, mas quer qualidade antes de escalar | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check → still the right priority?
3. Audit Out of Scope → reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after initialization*
