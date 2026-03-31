---
status: gaps_found
phase: 01-localizacao-e-strings
verified: 2026-03-30
---

## Verification Results

Verificação executada contra o estado atual do codebase. Todos os arquivos-alvo existem e a migração principal foi realizada, mas foram encontradas strings em inglês que podem ser exibidas ao usuário em cenários de produção.

### Arquivos verificados

| Arquivo | Existe | Importa strings.py | Strings hardcoded de UI |
|---------|--------|--------------------|------------------------|
| `src/bot/strings.py` | Sim (241 linhas, 48 constantes) | N/A — é o módulo fonte | Nenhuma em inglês |
| `src/bot/templates.py` | Sim | Sim (`from src.bot import strings`) | Nenhuma |
| `src/bot/handlers.py` | Sim | Sim (`from src.bot import strings`) | Gaps (ver abaixo) |
| `src/escalation/handler.py` | Sim | Sim (`from src.bot import strings`) | Nenhuma |
| `src/validation/questions.py` | Sim | Não importa strings.py | Gaps (ver abaixo) |
| `src/validation/classifier.py` | Sim | Não importa strings.py | Gaps (ver abaixo) |
| `src/rag/knowledge_base.py` | Sim | Não importa strings.py | Parcial (ver abaixo) |

---

## Must-Haves

### SC-1: Qualquer mensagem exibida ao usuário está em pt-br

**Status: FALHOU — gaps encontrados**

Strings em inglês que chegam ao usuário em produção:

1. **`src/bot/handlers.py` linha 218, 224, 483, 487** — fallback `"Unknown"` exibido em `/status` e `/lista` quando `created_at` ou `status` for nulo. Esses valores chegam diretamente na mensagem formatada pelo `format_status_report()` e `format_report_list()`.

2. **`src/bot/handlers.py` linha 329** — fallback hardcoded `"Issue requires human review"` como segundo argumento de `validation_result.get("summary", ...)`. Esse valor é passado para `escalation_handler.create_escalation(summary=...)` e exibido no `ESCALATION_MESSAGE` ao usuário via `format_escalation_message()`.

3. **`src/validation/questions.py` linhas 110–179** — todos os seis valores de retorno no campo `"summary"` de `validate_responses()` estão em inglês. Esses valores fluem para `validation_result.get("summary", ...)` em handlers.py linha 329 e podem aparecer na mensagem de escalação exibida ao usuário.

4. **`src/validation/classifier.py` linhas 204–376** — `_classify_with_keywords()` gera `summary` e `reason` em inglês; `should_escalate()` retorna `reason` em inglês. O campo `reason` de `EscalationDecision` é passado para `escalation_decision.reason` em handlers.py linha 329, que compõe o `summary` da escalação exibido ao usuário.

### SC-2: Nenhuma string literal de usuário fora de `src/bot/strings.py`

**Status: FALHOU — gaps encontrados**

- `"Unknown"` × 4 em `src/bot/handlers.py` (linhas 218, 224, 483, 487) — string de UI fora do módulo centralizado.
- `"Issue requires human review"` em `src/bot/handlers.py` linha 329 — string de UI fora do módulo centralizado.
- Seis strings `summary` em inglês em `src/validation/questions.py` (linhas 110–179) — não migradas para `strings.py`.
- `summary` e `reason` em inglês em `src/validation/classifier.py` — não migradas para `strings.py`.

### SC-3: Mensagens de erro exibem tom acolhedor em pt-br

**Status: PARCIALMENTE ATENDIDO**

`strings.py` define `ERROR_GENERIC` com tom acolhedor em pt-br. Erros de comando (`REPORT_MISSING_ARGS`, `STATUS_INVALID_ID`, etc.) estão corretos. Porém, `"Unknown"` exibido em campos de data/status e os summaries de escalação em inglês comprometem este critério em cenários específicos.

### SC-4: System prompts enviados ao LLM estão em pt-br

**Status: ATENDIDO**

- `src/validation/classifier.py` — `_classify_with_openai()` linha 232: system prompt em pt-br ("Você é um classificador de chamados de suporte..."). Chaves JSON de resposta mantidas em inglês por uso programático — correto.
- `src/rag/knowledge_base.py` — `_rerank_with_gpt4o()` linhas 428–440: prompt do usuário em pt-br; system prompt linha 445 em pt-br ("Você é um assistente de análise de chamados de suporte."). Atendido.

---

## Requirements Coverage

| ID | Descrição | Status | Observação |
|----|-----------|--------|------------|
| **L10N-01** | Todas as mensagens do bot em pt-br (botões, prompts, erros, confirmações) | **Parcial** | Botões, prompts principais e confirmações: corretos. Fallbacks `"Unknown"` e summaries de escalação em inglês: não atendidos. |
| **L10N-02** | System prompts do LLM reescritos em pt-br com tom profissional cordial | **Atendido** | `classifier.py` e `knowledge_base.py` com system prompts em pt-br. |
| **L10N-03** | Strings centralizadas em `src/bot/strings.py`, nenhuma string hardcoded em handlers | **Parcial** | `strings.py` criado com 48 constantes; handlers migrados na maioria. Gaps: `"Unknown"` × 4, fallback `"Issue requires human review"`, summaries em `questions.py` e `classifier.py` não centralizados. |
| **L10N-04** | Mensagens de erro e fallback em pt-br com tom acolhedor | **Parcial** | Mensagens de erro de comando corretas. Fallbacks internos (`"Unknown"`, summaries de escalação) ainda em inglês. |

---

## Gaps a Corrigir

| # | Arquivo | Linha(s) | Problema | Ação necessária |
|---|---------|----------|---------|-----------------|
| G1 | `src/bot/handlers.py` | 218, 224, 483, 487 | `"Unknown"` como fallback de data/status | Adicionar `strings.STATUS_UNKNOWN = "Desconhecido"` e substituir |
| G2 | `src/bot/handlers.py` | 329 | `"Issue requires human review"` hardcoded como fallback de summary | Adicionar constante em `strings.py` e substituir |
| G3 | `src/validation/questions.py` | 110–179 | Seis summaries de `validate_responses()` em inglês | Traduzir para pt-br ou centralizar em `strings.py` |
| G4 | `src/validation/classifier.py` | 204, 216, 308–376 | `summary` e `reason` em inglês em `_classify_with_keywords()` e `should_escalate()` | Traduzir para pt-br ou centralizar em `strings.py` |

---

*Verificação realizada em: 2026-03-30*
*Última atualização: 2026-03-30*
