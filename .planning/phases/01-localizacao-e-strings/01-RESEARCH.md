# Phase 1: Localizacao e Strings — Research

**Gathered:** 2026-03-30
**Requirements addressed:** L10N-01, L10N-02, L10N-03, L10N-04

---

## 1. Inventario Completo de Strings

### 1.1 BOT_MESSAGES em `src/bot/templates.py`

Todas as 14 entradas do dicionario sao user-facing e precisam ser migradas para `strings.py` em pt-br.

| Chave | Linha | Conteudo original (resumo) | Tem variaveis? |
|---|---|---|---|
| `welcome` | 9-11 | "Welcome to N1 Support Bot! ..." | Nao |
| `help` | 13-22 | Lista de comandos disponiveis | Nao |
| `acknowledge` | 24-26 | "I've received your issue... Your report ID is: {report_id}" | `{report_id}` |
| `ask_question` | 28-31 | "Question {current}/{total}:\n{question}\n\nPlease answer below." | `{current}`, `{total}`, `{question}` |
| `known_issue` | 33-38 | "I found information... {summary}... Steps: {steps}..." | `{summary}`, `{steps}` |
| `escalate` | 40-47 | "I've analyzed your issue... Issue: {issue}... Project: {project}... Impact: {impact}... report ID: {report_id}" | `{issue}`, `{project}`, `{impact}`, `{report_id}` |
| `status_format` | 49-54 | "Report Status\n... Report ID: {report_id}... Status: {status}..." | `{report_id}`, `{status}`, `{created_at}`, `{escalated}` |
| `cancel` | 55 | "Conversation cancelled. If you have another issue..." | Nao |
| `error` | 56 | "Sorry, something went wrong. Please try again or use /cancel..." | Nao |
| `search_results` | 57 | "Search results for '{query}':\n\n{results}" | `{query}`, `{results}` |
| `no_results` | 58 | "No results found for '{query}'..." | `{query}` |
| `feedback_success` | 59 | "Thank you for your feedback! Report {report_id} rated {rating}/5..." | `{report_id}`, `{rating}` |
| `report_list` | 60 | "Your Recent Reports:\n\n{reports}" | `{reports}` |
| `report_item` | 61 | "• [{status}] {description}\n  ID: `{report_id}`..." | `{status}`, `{description}`, `{report_id}`, `{created_at}`, `{rating_text}` |
| `confirmation` | 62 | "Did this resolve your issue?" | Nao |

**Strings em funcoes de `templates.py` (fora do dict):**

| Local | Linha | Conteudo | Observacao |
|---|---|---|---|
| `format_escalation()` default param | 94 | `"Not specified"` | Valor padrao de argumento |
| `format_escalation()` default param | 95 | `"To be determined"` | Valor padrao de argumento |
| `format_search_results()` f-string | 179-181 | `f"*{i}. {r['title']}*\n   Area: {r['area']}\n   {r['content'][:150]}..."` | Template de item de busca |
| `get_confirmation_keyboard()` | 237 | `"Yes, resolved"` | Label de botao inline |
| `get_confirmation_keyboard()` | 238 | `"No, still need help"` | Label de botao inline |
| `format_status_report()` | 162 | `"Yes"` / `"No"` | Valor booleano traduzido |

---

### 1.2 Strings hardcoded em `src/bot/handlers.py` (fora de BOT_MESSAGES)

| Linha | String | Contexto |
|---|---|---|
| 91-92 | `"Please provide an issue description. Usage: /report <your issue>"` | `/report` sem args |
| 192 | `"Please provide a report ID. Usage: /status <report_id>"` | `/status` sem args |
| 204 | `"Invalid report ID format. Please provide a valid UUID."` | `/status` com UUID invalido |
| 215-216 | `f"Report {report_id} not found."` | f-string — relatorio nao encontrado |
| 253 | `"Please send a text response."` | Mensagem nao-texto recebida |
| 260-261 | `"Welcome! Use /report <issue> to report a problem or /help for available commands."` | Estado IDLE recebe mensagem |
| 289-290 | `"Thank you for your answers. I'm analyzing your issue..."` | Apos ultima resposta de validacao |
| 340 | `"Issue requires human review"` | Fallback em `validation_result.get()` |
| 393 | `"Check the knowledge base article for resolution steps."` | Passo de self-service sem artigos ricos |
| 410 | `"Unknown issue"` | Fallback em `user_state.issue_description or ...` |
| 428-431 | `"This issue has been escalated to our support team. You'll be notified when there's an update. Use /status <report_id> to check progress."` | Estado ESCALATED recebe mensagem |
| 448-449 | `"Please provide a search query. Usage: /search <your query>"` | `/search` sem args |
| 461-463 | `f"No results found for: {query}\n\nTry different keywords or /report to create a support ticket."` | f-string — nenhum resultado de busca |
| 489 | `"Invalid user ID."` | UUID de usuario invalido |
| 497-499 | `"You have no recent reports. Use /report <issue> to create one."` | `/list` sem relatorios |
| 527-528 | `"Please provide a report ID and rating (1-5). Usage: /feedback <report_id> <1-5>"` | `/feedback` sem args suficientes |
| 541 | `"Invalid rating. Please provide a number between 1 and 5."` | Rating fora do range |
| 551 | `"Invalid report ID format. Please provide a valid UUID."` | UUID invalido em `/feedback` |
| 560 | `f"Report {report_id} not found."` | f-string — relatorio nao encontrado em feedback |
| 583-585 | `"Great! I'm glad I could help resolve your issue. If you have any other problems, don't hesitate to reach out. Use /list to view your recent reports."` | Callback `yes_resolved` |
| 597-600 | `"I'm sorry the guidance didn't resolve your issue. Let me escalate this to our support team for further assistance. Use /status <report_id> to check progress."` | Callback `no_unresolved` |
| 611 | `"User indicated guidance did not resolve issue"` | Resumo de escalacao interna |

---

### 1.3 Strings em `src/escalation/handler.py`

Estas strings sao user-facing (usadas em `format_escalation_message` e `format_self_service_message`):

| Linha | String |
|---|---|
| 134 | `"I've analyzed your issue and identified a potential problem that requires human investigation."` |
| 135 | `""` (linha em branco) |
| 136 | `"Summary:"` |
| 137 | `f"- Issue: {escalation.summary}"` |
| 138 | `f"- Project: {escalation.project_name or 'Not specified'}"` |
| 139 | `f"- Impact: {escalation.impact or 'To be determined'}"` |
| 141 | `"I'm escalating this to our support team. A human agent will review and respond shortly."` |
| 143 | `f"Your report ID: {escalation.user_report_id}"` |
| 148 | `"In the meantime:"` |
| 153 | `"- You may also want to check our known issues database"` |
| 179 | `"I found information about this in our knowledge base."` |
| 185 | `"Steps to resolve:"` |
| 194 | `"If this does not resolve your issue, please let me know and I will escalate to a human agent."` |

**Observacao critica:** `EscalationHandler.format_escalation_message()` e `format_self_service_message()` sao metodos proprios que constroem strings — eles duplicam o template do `BOT_MESSAGES["escalate"]` e `BOT_MESSAGES["known_issue"]`. Devem ser refatorados para usar as constantes de `strings.py`.

---

### 1.4 Strings em `src/validation/questions.py`

Estas strings sao exibidas diretamente ao usuario como perguntas de validacao:

**Categoria `data_missing`:**
| ID | Linha | Pergunta |
|---|---|---|
| dm1 | 36 | "Which project are you working in?" |
| dm2 | 37 | "Can you confirm the data should exist in that project?" |
| dm3 | 38 | "Have you tried refreshing the page?" |
| dm4 | 39 | "What do you see when you look for the data?" |

**Categoria `document_generation`:**
| ID | Linha | Pergunta |
|---|---|---|
| dg1 | 42 | "Which transcript are you generating from?" |
| dg2 | 43 | "What document type did you select?" |
| dg3 | 44 | "Did you receive any error message?" |
| dg4 | 45 | "How long did you wait before it failed?" |

**Categoria `task_sprint`:**
| ID | Linha | Pergunta |
|---|---|---|
| ts1 | 48 | "Which project and sprint is this task in?" |
| ts2 | 49 | "What status does the task currently show?" |
| ts3 | 50 | "Are you assigned as the task owner?" |
| ts4 | 51 | "Have you tried updating the task status?" |

**Categoria `login_auth`:**
| ID | Linha | Pergunta |
|---|---|---|
| la1 | 54 | "Are you seeing any error message?" |
| la2 | 55 | "Have you tried clearing your browser cache?" |
| la3 | 56 | "Can you try a different browser?" |
| la4 | 57 | "Did your password recently change?" |

**Categoria `general`:**
| ID | Linha | Pergunta |
|---|---|---|
| g1 | 60 | "Can you provide more details about what happened?" |
| g2 | 61 | "When did this issue start?" |
| g3 | 62 | "Does this happen every time or only sometimes?" |

**Strings internas de `validate_responses()` (nao user-facing, nao migrar para strings.py):**
- Linha 110: `"Number of answers does not match questions asked."` — summary interno
- Linha 120: `"Insufficient information provided for validation."` — summary interno
- Linha 155: `"User indicated the issue has been resolved."` — summary interno
- Linha 163: `"User indicated this was a misunderstanding on their part."` — summary interno
- Linha 171: `"User confirms the issue persists after troubleshooting."` — summary interno
- Linha 179: `"Issue requires human review for resolution."` — summary interno

**Decisao:** Estas sao strings de log/dados internas usadas em sumarios de validacao, nao exibidas diretamente ao usuario. Permanecem em `questions.py` e nao entram em `strings.py`.

---

### 1.5 Strings em `src/validation/classifier.py`

Strings de `reason` em `EscalationDecision` sao internas (logs de classificacao), nao exibidas ao usuario. **Nao migrar para `strings.py`.**

---

## 2. Inventario de System Prompts LLM

### 2.1 System prompt em `src/validation/classifier.py`

**Arquivo:** `src/validation/classifier.py`
**Linhas:** 232-253
**Metodo:** `_classify_with_openai()`

```
You are a support issue classifier for a workforce management system.
Classify the issue into one of these categories:
...
Respond with a JSON object: {...}
```

**Precisa ser reescrito em pt-br.** O JSON de resposta esperado deve permanecer em ingles (chaves `category`, `confidence`, `summary`, `area`) pois sao usadas programaticamente com `.get()`.

---

### 2.2 System prompt em `src/rag/knowledge_base.py`

**Arquivo:** `src/rag/knowledge_base.py`
**Linha:** 445
**Metodo:** `_rerank_with_gpt4o()`

```python
{"role": "system", "content": "You are a support ticket analysis assistant."}
```

**Precisa ser reescrito em pt-br.**

Tambem ha um user prompt inline (linhas 428-440) na mesma funcao:

```python
prompt = f"""Given the user's issue: "{issue_description}"

Evaluate each knowledge base article below for relevance...
Score each article from 0-10 where:
- 10 = Highly relevant...
...
Return only a JSON array of scores in order, like: [8, 3, 9, 2, 5]
Only return the array, nothing else."""
```

**O user prompt tambem precisa ser traduzido.** A instrucao de formato JSON pode permanecer em ingles por ser instrucao tecnica estrutural.

---

## 3. Estrutura Recomendada para `strings.py`

### Decisao: Constantes UPPER_SNAKE_CASE agrupadas por dominio

Justificativa:
- Segue convencao do codebase (`STOPWORDS`, `RELATED_TERMS`, `CATEGORY_KEYWORDS`)
- Mais legivel que dicionario aninhado para constantes estaticas
- Autocomplete de IDE funciona diretamente com `from src.bot.strings import WELCOME`
- F-strings com variaveis ficam naturais: `REPORT_NOT_FOUND.format(report_id=x)`
- Facilita busca por `grep WELCOME` ou rastreamento de uso

### Estrutura proposta de `src/bot/strings.py`

```python
"""Strings centralizadas do bot em pt-br com tom profissional cordial."""

# --- Comandos basicos ---
WELCOME = (
    "Ola! Bem-vindo ao Suporte N1 do Workforce. "
    "Estou aqui para ajudar voce a resolver duvidas ou reportar problemas no sistema. "
    "Use /ajuda para ver os comandos disponiveis."
)

HELP = (
    "Comandos disponiveis:\n"
    "/start - Iniciar uma nova conversa\n"
    "/ajuda - Exibir esta mensagem de ajuda\n"
    "/report <descricao> - Reportar um problema\n"
    "/status <id_report> - Consultar o status de um chamado\n"
    "/buscar <termo> - Buscar na base de conhecimento\n"
    "/lista - Ver seus chamados recentes\n"
    "/feedback <id_report> <1-5> - Avaliar um chamado\n"
    "/cancelar - Cancelar a conversa atual"
)

CANCEL = (
    "Conversa encerrada. Se precisar de ajuda novamente, use /report para abrir um novo chamado."
)

ERROR_GENERIC = (
    "Ocorreu um problema inesperado. Por favor, tente novamente ou use /cancelar para recomecar."
)

# --- Idle / redirecionamento ---
IDLE_REDIRECT = (
    "Ola! Para reportar um problema, use /report <descricao>. "
    "Para ver os comandos disponiveis, use /ajuda."
)

NON_TEXT_MESSAGE = "Por favor, envie uma mensagem de texto."

# --- Fluxo de report ---
REPORT_MISSING_ARGS = (
    "Por favor, descreva o problema. Exemplo de uso: /report <descricao do problema>"
)

REPORT_ACKNOWLEDGED = (
    "Recebi o seu chamado. Vou fazer algumas perguntas para entender melhor o problema.\n\n"
    "Numero do chamado: {report_id}"
)

VALIDATION_QUESTION = (
    "Pergunta {current} de {total}:\n"
    "{question}\n\n"
    "Por favor, responda abaixo."
)

VALIDATION_ANALYZING = (
    "Obrigado pelas suas respostas. Estou analisando o problema..."
)

# --- Orientacao por base de conhecimento ---
SELF_SERVICE_GUIDANCE = (
    "Encontrei informacoes relacionadas ao seu problema na base de conhecimento.\n\n"
    "{summary}\n\n"
    "Passos para resolver:\n"
    "{steps}\n\n"
    "Se isso nao resolver o problema, me avise e abrirei um chamado com a equipe de suporte."
)

CONFIRMATION_QUESTION = "Isso resolveu o seu problema?"

# --- Escalacao ---
ESCALATION_MESSAGE = (
    "Analisei o seu problema e identifiquei que ele requer atendimento humano.\n\n"
    "Resumo:\n"
    "- Problema: {issue}\n"
    "- Projeto: {project}\n"
    "- Impacto: {impact}\n\n"
    "Vou encaminhar para a equipe de suporte. Um agente ira analisar e responder em breve.\n\n"
    "Numero do chamado: {report_id}"
)

ESCALATION_WORKAROUNDS_HEADER = "Enquanto isso:"
ESCALATION_KNOWN_ISSUES_TIP = "- Voce tambem pode consultar nossa base de problemas conhecidos"

ESCALATED_STATE_MESSAGE = (
    "Este chamado ja foi encaminhado para a equipe de suporte. "
    "Voce sera notificado quando houver uma atualizacao. "
    "Use /status <id_chamado> para acompanhar o progresso."
)

ESCALATION_SELF_SERVICE_INTRO = (
    "Encontrei informacoes sobre este problema na base de conhecimento."
)

ESCALATION_STEPS_HEADER = "Passos para resolver:"

ESCALATION_NOT_RESOLVED_FOLLOWUP = (
    "Se isso nao resolver o problema, me avise e encaminharei para um agente humano."
)

# --- Callbacks inline ---
CALLBACK_RESOLVED = (
    "Que otimo! Fico feliz em ter ajudado. "
    "Caso precise de suporte novamente, estou a disposicao. "
    "Use /lista para ver seus chamados anteriores."
)

CALLBACK_NOT_RESOLVED = (
    "Lamento que a orientacao nao tenha resolvido o problema. "
    "Vou encaminhar para a equipe de suporte para uma analise mais detalhada. "
    "Use /status <id_chamado> para acompanhar o progresso."
)

CALLBACK_ESCALATION_SUMMARY = "Usuario informou que a orientacao nao resolveu o problema"

# --- Botoes inline ---
BTN_YES_RESOLVED = "Sim, resolveu"
BTN_NO_UNRESOLVED = "Nao, ainda preciso de ajuda"

# --- Status de relatorio ---
STATUS_REPORT = (
    "Status do Chamado\n\n"
    "Numero: {report_id}\n"
    "Status: {status}\n"
    "Criado em: {created_at}\n"
    "Escalado: {escalated}"
)

STATUS_ESCALATED_YES = "Sim"
STATUS_ESCALATED_NO = "Nao"

STATUS_MISSING_ARGS = (
    "Por favor, informe o numero do chamado. Exemplo de uso: /status <id_chamado>"
)

STATUS_INVALID_ID = "Formato de ID invalido. Por favor, informe um UUID valido."

STATUS_NOT_FOUND = "Chamado {report_id} nao encontrado."

# --- Busca ---
SEARCH_MISSING_ARGS = (
    "Por favor, informe o termo de busca. Exemplo de uso: /buscar <termo>"
)

SEARCH_RESULTS = "Resultados para '{query}':\n\n{results}"

SEARCH_NO_RESULTS = (
    "Nenhum resultado encontrado para: {query}\n\n"
    "Tente palavras-chave diferentes ou use /report para abrir um chamado."
)

SEARCH_RESULT_ITEM = "*{index}. {title}*\n   Area: {area}\n   {excerpt}"

# --- Lista de relatorios ---
LIST_NO_REPORTS = (
    "Voce ainda nao tem chamados. Use /report <descricao> para criar o primeiro."
)

LIST_HEADER = "Seus Chamados Recentes:\n\n{reports}"

LIST_ITEM = "• [{status}] {description}\n  ID: `{report_id}`\n  Criado em: {created_at}{rating_text}\n"

LIST_INVALID_USER = "ID de usuario invalido."

# --- Feedback ---
FEEDBACK_MISSING_ARGS = (
    "Por favor, informe o numero do chamado e a avaliacao (1-5). "
    "Exemplo de uso: /feedback <id_chamado> <1-5>"
)

FEEDBACK_INVALID_RATING = "Avaliacao invalida. Por favor, informe um numero entre 1 e 5."

FEEDBACK_INVALID_ID = "Formato de ID invalido. Por favor, informe um UUID valido."

FEEDBACK_NOT_FOUND = "Chamado {report_id} nao encontrado."

FEEDBACK_SUCCESS = (
    "Obrigado pela sua avaliacao! Chamado {report_id} avaliado com {rating}/5.\n\n"
    "Agradecemos o seu feedback para melhorarmos o servico."
)

# --- Valores padrao internos (usados como fallback em format_escalation) ---
DEFAULT_PROJECT_NOT_SPECIFIED = "Nao informado"
DEFAULT_IMPACT_UNDETERMINED = "A determinar"

DEFAULT_SELF_SERVICE_STEP = "Consulte o artigo da base de conhecimento para os passos de resolucao."
DEFAULT_ESCALATION_SUMMARY = "Chamado requer analise humana"
DEFAULT_ISSUE_DESCRIPTION = "Sem descricao"
```

---

## 4. Inventario de System Prompts LLM — Reescrita Recomendada

### 4.1 `classifier.py` — `_classify_with_openai()` (linhas 232-253)

**Atual:** prompt inteiramente em ingles

**Reescrito em pt-br:**

```python
CLASSIFIER_SYSTEM_PROMPT = """Voce e um classificador de chamados de suporte para um sistema de gestao de workforce.
Classifique o problema em uma destas categorias:
- data_missing: Usuario nao consegue encontrar ou acessar dados que deveriam existir
- document_generation: Problemas com geracao de documentos por IA (PRD, user stories, etc.)
- task_sprint: Problemas com tarefas, sprints ou planejamento de projetos
- login_auth: Problemas de login, autenticacao ou sessao
- general: Problemas que nao se encaixam nas outras categorias

Tambem identifique a area da base de conhecimento:
- foundation: Funcionalidades centrais do sistema
- document-generation: Criacao de documentos e templates
- frontend: Interface do usuario e problemas de exibicao
- planning: Gestao de tarefas e sprints
- support: Topicos gerais de suporte

Responda com um objeto JSON:
{
    "category": "nome_da_categoria",
    "confidence": 0.0-1.0,
    "summary": "descricao breve",
    "area": "area_kb"
}"""
```

**Nota:** As chaves do JSON (`category`, `confidence`, `summary`, `area`) permanecem em ingles pois sao usadas programaticamente em `parsed.get("category", "general")`.

---

### 4.2 `knowledge_base.py` — `_rerank_with_gpt4o()` (linhas 428-450)

**System prompt atual (linha 445):**
```
"You are a support ticket analysis assistant."
```

**Reescrito:**
```
"Voce e um assistente de analise de chamados de suporte."
```

**User prompt atual (linhas 428-440) — reescrito:**
```python
prompt = f"""Problema relatado pelo usuario: "{issue_description}"

Avalie cada artigo da base de conhecimento abaixo quanto a relevancia para resolver este problema.
Atribua uma pontuacao de 0 a 10 para cada artigo, onde:
- 10 = Altamente relevante, aborda diretamente o problema
- 5 = Parcialmente relevante, contem informacoes relacionadas
- 0 = Irrelevante, nao auxilia na resolucao do problema

Artigos:
{chr(10).join([f"[{i+1}] {text}" for i, text in enumerate(candidate_texts)])}

Retorne apenas um array JSON com as pontuacoes em ordem, como: [8, 3, 9, 2, 5]
Retorne apenas o array, sem mais nada."""
```

---

## 5. Plano de Migracao

### 5.1 O que vai para `strings.py`

1. Todo o `BOT_MESSAGES` de `templates.py` — desmembrado em constantes individuais
2. Todas as strings hardcoded de `handlers.py` listadas na secao 1.2
3. Labels de botoes inline (`BTN_YES_RESOLVED`, `BTN_NO_UNRESOLVED`)
4. Valores padrao de parametros em `format_escalation()` (`DEFAULT_PROJECT_NOT_SPECIFIED`, `DEFAULT_IMPACT_UNDETERMINED`)
5. Strings do `EscalationHandler.format_escalation_message()` e `format_self_service_message()`
6. Perguntas de validacao de `questions.py` (section CATEGORY_QUESTIONS)

### 5.2 O que NAO vai para `strings.py`

- Strings de log (`logger.info`, `logger.error`) — permanecem nos modulos originais
- Summaries internos de `validate_responses()` — dados de negocio, nao user-facing
- Reasons de `EscalationDecision` — usadas em logs internos e sumarios de chamado
- Mensagens de erro de configuracao (`ValueError: "TELEGRAM_BOT_TOKEN is required"`)
- System prompts LLM — permanecem nos seus arquivos de origem, mas reescritos em pt-br

### 5.3 Ordem de alteracoes

1. Criar `src/bot/strings.py` com todas as constantes
2. Atualizar `src/bot/templates.py`:
   - Importar constantes de `strings`
   - Substituir `BOT_MESSAGES` pelo novo modulo
   - Manter as funcoes `format_*` (interface publica nao muda)
   - Atualizar defaults de `format_escalation()` para usar `DEFAULT_*`
   - Atualizar labels de `get_confirmation_keyboard()` para `BTN_*`
3. Atualizar `src/bot/handlers.py`:
   - Importar de `strings` em vez de usar strings literais
   - Substituir todos os literais da secao 1.2
4. Atualizar `src/escalation/handler.py`:
   - Importar de `strings`
   - Refatorar `format_escalation_message()` e `format_self_service_message()` para usar constantes
5. Atualizar `src/validation/questions.py`:
   - Importar constantes de perguntas de `strings` (ou manter as Questions in-place com texto pt-br — ver nota abaixo)
6. Atualizar `src/validation/classifier.py`:
   - Reescrever `_classify_with_openai()` com prompt pt-br
7. Atualizar `src/rag/knowledge_base.py`:
   - Reescrever prompts de `_rerank_with_gpt4o()` em pt-br

### 5.4 Nota sobre `questions.py`

As perguntas de validacao sao constantes estruturadas (objetos `Question` com `id`, `text`, `options`). Ha duas opcoes:

**Opcao A (recomendada):** Reescrever os textos das `Question` diretamente em `questions.py` — o texto e propriedade do objeto, nao uma string solta. Nao mover para `strings.py`.

**Opcao B:** Exportar apenas os textos como constantes em `strings.py` e importar em `questions.py`. Aumenta acoplamento sem ganho pratico.

**Decisao:** Opcao A. O modulo `questions.py` contem a definicao estrutural das perguntas; traduzir in-place respeita o principio de Single Responsibility.

---

## 6. Casos Especiais e Edge Cases

### 6.1 F-strings com variaveis (nao podem ser constantes simples)

Estas strings contem variaveis e devem usar `.format()` ou ser templates:

| Constante | Variaveis | Exemplo de uso |
|---|---|---|
| `REPORT_ACKNOWLEDGED` | `{report_id}` | `REPORT_ACKNOWLEDGED.format(report_id=report.id)` |
| `VALIDATION_QUESTION` | `{current}`, `{total}`, `{question}` | `.format(current=1, total=3, question=q)` |
| `SELF_SERVICE_GUIDANCE` | `{summary}`, `{steps}` | `.format(summary=s, steps=st)` |
| `ESCALATION_MESSAGE` | `{issue}`, `{project}`, `{impact}`, `{report_id}` | `.format(...)` |
| `STATUS_REPORT` | `{report_id}`, `{status}`, `{created_at}`, `{escalated}` | `.format(...)` |
| `STATUS_NOT_FOUND` | `{report_id}` | `.format(report_id=r)` |
| `SEARCH_RESULTS` | `{query}`, `{results}` | `.format(query=q, results=r)` |
| `SEARCH_NO_RESULTS` | `{query}` | `.format(query=q)` |
| `SEARCH_RESULT_ITEM` | `{index}`, `{title}`, `{area}`, `{excerpt}` | `.format(...)` |
| `LIST_HEADER` | `{reports}` | `.format(reports=r)` |
| `LIST_ITEM` | `{status}`, `{description}`, `{report_id}`, `{created_at}`, `{rating_text}` | `.format(...)` |
| `FEEDBACK_NOT_FOUND` | `{report_id}` | `.format(report_id=r)` |
| `FEEDBACK_SUCCESS` | `{report_id}`, `{rating}` | `.format(report_id=r, rating=rt)` |

**Padrao recomendado:** Usar `.format()` explicito em vez de f-strings para que as constantes em `strings.py` sejam strings simples (sem contexto de execucao).

### 6.2 Strings multilinhas

As strings `WELCOME`, `HELP`, `ESCALATION_MESSAGE`, etc. sao multilinhas. Usar parenteses com concatenacao implicita ou triple-quotes. Preferir parenteses com strings separadas para facilitar manutencao:

```python
WELCOME = (
    "Ola! Bem-vindo ao Suporte N1 do Workforce. "
    "Estou aqui para ajudar voce a resolver duvidas ou reportar problemas no sistema. "
    "Use /ajuda para ver os comandos disponiveis."
)
```

### 6.3 Duplicacao entre `templates.py` e `escalation/handler.py`

`format_escalation_message()` em `handler.py` e `BOT_MESSAGES["escalate"]` em `templates.py` sao templates equivalentes para a mesma mensagem de escalacao. Apos a migracao, ambos devem usar a mesma constante `ESCALATION_MESSAGE` de `strings.py`. O metodo `format_escalation_message()` em `handler.py` pode ser simplificado para delegar ao `format_escalation()` de `templates.py` ou usar diretamente `ESCALATION_MESSAGE`.

### 6.4 Strings que ja sao fallbacks internos (nao substituir por strings.py)

- `handler.py` linha 340: `validation_result.get("summary", "Issue requires human review")` — o fallback `"Issue requires human review"` deve ser traduzido mas pode permanecer inline, pois e fallback de dado de negocio.
- `handler.py` linha 410: `user_state.issue_description or "Unknown issue"` — traduzir para `DEFAULT_ISSUE_DESCRIPTION`.

### 6.5 `format_search_results()` contem template de item inline

A linha 179-181 de `templates.py` tem um template de item de resultado formatado com Markdown:

```python
f"*{i}. {r['title']}*\n   Area: {r['area']}\n   {r['content'][:150]}..."
```

Esta string deve se tornar `SEARCH_RESULT_ITEM` com o label `Area:` traduzido para `Area:` (ja em pt-br coincidentemente) e o template extraido para `strings.py`.

### 6.6 `"Yes"` / `"No"` como traducao de booleano em `format_status_report()`

Linha 162 de `templates.py`: `escalated="Yes" if escalated else "No"`. Usar `STATUS_ESCALATED_YES` e `STATUS_ESCALATED_NO`.

### 6.7 Tom profissional cordial — diretrizes

- Tratamento por "voce" (nao "senhor/senhora")
- Sem girias, sem abreviacoes informais
- Mensagens de erro devem oferecer uma acao: "tente novamente", "use /cancelar", "use /ajuda"
- Confirmacoes positivas: "Que otimo!", "Obrigado"
- Mensagens de escalacao: reassegurar o usuario que sera atendido, nao apenas informar o encaminhamento

---

## 7. Resumo Executivo para Planejamento

| Dimensao | Quantidade |
|---|---|
| Constantes a criar em `strings.py` | ~40 constantes |
| Arquivos a modificar | 5 (`handlers.py`, `templates.py`, `escalation/handler.py`, `validation/questions.py`, `rag/knowledge_base.py`) |
| System prompts LLM a traduzir | 2 prompts (classifier + reranker) |
| Perguntas de validacao a traduzir | 19 perguntas |
| F-strings com variaveis | 14 constantes com `.format()` |
| Strings duplicadas entre modulos | 2 (escalation template, self-service template) |

**Risco principal:** `EscalationHandler.format_escalation_message()` constroi a mensagem diretamente via lista de strings — refatora-la para usar `ESCALATION_MESSAGE.format()` requer cuidado com os campos opcionais (`workarounds`, `known_issues`). Sugestao: manter a logica condicional mas trocar os literais por constantes.

**Nenhuma alteracao de interface publica necessaria:** As funcoes `format_*` em `templates.py` continuam com as mesmas assinaturas. Somente os internos mudam.
