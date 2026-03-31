---
phase: 1
plan: 3
title: "Migrar src/bot/handlers.py e src/escalation/handler.py para usar strings.py"
wave: 2
depends_on: [1]
files_modified: ["src/bot/handlers.py", "src/escalation/handler.py"]
requirements_addressed: ["L10N-01", "L10N-03", "L10N-04"]
autonomous: true
estimated_tasks: 2
---

<task id="1">
<title>Substituir todas as strings hardcoded user-facing em handlers.py pelas constantes de strings.py</title>
<read_first>
- src/bot/handlers.py (identificar todas as strings literais fora de BOT_MESSAGES: linhas 90-92, 192, 203-204, 215-216, 253, 260-261, 289-290, 393, 410, 428-431, 448-449, 461-463, 489, 497-499, 527-528, 541, 551, 560, 583-585, 597-600, 611)
- src/bot/strings.py (verificar nomes exatos das constantes antes de substituir)
</read_first>
<action>
Adicionar o import de strings no topo de `src/bot/handlers.py`, logo apos os imports locais existentes:

```python
from src.bot import strings
```

Em seguida, substituir cada string hardcoded user-facing pela constante correspondente de strings.py:

**Linha ~90-92** — `/report` sem args:
```python
# ANTES:
await update.message.reply_text(
    "Please provide an issue description. Usage: /report <your issue>"
)
# DEPOIS:
await update.message.reply_text(strings.REPORT_MISSING_ARGS)
```

**Linha ~192** — `/status` sem args:
```python
# ANTES:
await update.message.reply_text(
    "Please provide a report ID. Usage: /status <report_id>"
)
# DEPOIS:
await update.message.reply_text(strings.STATUS_MISSING_ARGS)
```

**Linha ~203-204** — UUID invalido em `/status`:
```python
# ANTES:
await update.message.reply_text(
    "Invalid report ID format. Please provide a valid UUID."
)
# DEPOIS:
await update.message.reply_text(strings.STATUS_INVALID_ID)
```

**Linha ~215-216** — relatorio nao encontrado em `/status`:
```python
# ANTES:
await update.message.reply_text(
    f"Report {report_id} not found."
)
# DEPOIS:
await update.message.reply_text(strings.STATUS_NOT_FOUND.format(report_id=report_id))
```

**Linha ~253** — mensagem nao-texto em handle_message:
```python
# ANTES:
await update.message.reply_text("Please send a text response.")
# DEPOIS:
await update.message.reply_text(strings.NON_TEXT_MESSAGE)
```

**Linha ~260-261** — estado IDLE recebe mensagem:
```python
# ANTES:
await update.message.reply_text(
    "Welcome! Use /report <issue> to report a problem or /help for available commands."
)
# DEPOIS:
await update.message.reply_text(strings.IDLE_REDIRECT)
```

**Linha ~289-290** — apos ultima resposta de validacao:
```python
# ANTES:
await update.message.reply_text(
    "Thank you for your answers. I'm analyzing your issue..."
)
# DEPOIS:
await update.message.reply_text(strings.VALIDATION_ANALYZING)
```

**Linha ~393** — self-service sem artigos ricos (steps fallback):
```python
# ANTES:
steps = ["Check the knowledge base article for resolution steps."]
# DEPOIS:
steps = [strings.DEFAULT_SELF_SERVICE_STEP]
```

**Linha ~410** — fallback de issue_description em format_escalation:
```python
# ANTES:
issue=user_state.issue_description or "Unknown issue",
# DEPOIS:
issue=user_state.issue_description or strings.DEFAULT_ISSUE_DESCRIPTION,
```

**Linha ~428-431** — estado ESCALATED recebe mensagem:
```python
# ANTES:
await update.message.reply_text(
    "This issue has been escalated to our support team. "
    "You'll be notified when there's an update. Use /status <report_id> to check progress."
)
# DEPOIS:
await update.message.reply_text(strings.ESCALATED_STATE_MESSAGE)
```

**Linha ~448-449** — `/search` sem args:
```python
# ANTES:
await update.message.reply_text(
    "Please provide a search query. Usage: /search <your query>"
)
# DEPOIS:
await update.message.reply_text(strings.SEARCH_MISSING_ARGS)
```

**Linha ~461-463** — nenhum resultado de busca:
```python
# ANTES:
await update.message.reply_text(
    f"No results found for: {query}\n\n"
    "Try different keywords or /report to create a support ticket."
)
# DEPOIS:
await update.message.reply_text(strings.SEARCH_NO_RESULTS.format(query=query))
```

**Linha ~489** — UUID de usuario invalido em `/list`:
```python
# ANTES:
await update.message.reply_text("Invalid user ID.")
# DEPOIS:
await update.message.reply_text(strings.LIST_INVALID_USER)
```

**Linha ~497-499** — sem relatorios em `/list`:
```python
# ANTES:
await update.message.reply_text(
    "You have no recent reports. Use /report <issue> to create one."
)
# DEPOIS:
await update.message.reply_text(strings.LIST_NO_REPORTS)
```

**Linha ~527-528** — `/feedback` sem args:
```python
# ANTES:
await update.message.reply_text(
    "Please provide a report ID and rating (1-5). Usage: /feedback <report_id> <1-5>"
)
# DEPOIS:
await update.message.reply_text(strings.FEEDBACK_MISSING_ARGS)
```

**Linha ~541** — rating invalido em `/feedback`:
```python
# ANTES:
await update.message.reply_text(
    "Invalid rating. Please provide a number between 1 and 5."
)
# DEPOIS:
await update.message.reply_text(strings.FEEDBACK_INVALID_RATING)
```

**Linha ~551** — UUID invalido em `/feedback`:
```python
# ANTES:
await update.message.reply_text(
    "Invalid report ID format. Please provide a valid UUID."
)
# DEPOIS:
await update.message.reply_text(strings.FEEDBACK_INVALID_ID)
```

**Linha ~560** — relatorio nao encontrado em `/feedback`:
```python
# ANTES:
await update.message.reply_text(f"Report {report_id} not found.")
# DEPOIS:
await update.message.reply_text(strings.FEEDBACK_NOT_FOUND.format(report_id=report_id))
```

**Linha ~583-585** — callback `yes_resolved`:
```python
# ANTES:
await query.edit_message_text(
    text="Great! I'm glad I could help resolve your issue. "
         "If you have any other problems, don't hesitate to reach out. "
         "Use /list to view your recent reports."
)
# DEPOIS:
await query.edit_message_text(text=strings.CALLBACK_RESOLVED)
```

**Linha ~597-600** — callback `no_unresolved`:
```python
# ANTES:
await query.edit_message_text(
    text="I'm sorry the guidance didn't resolve your issue. "
         "Let me escalate this to our support team for further assistance. "
         "Use /status <report_id> to check progress."
)
# DEPOIS:
await query.edit_message_text(text=strings.CALLBACK_NOT_RESOLVED)
```

**Linha ~611** — summary de escalacao interno no callback:
```python
# ANTES:
summary="User indicated guidance did not resolve issue",
# DEPOIS:
summary=strings.CALLBACK_ESCALATION_SUMMARY,
```

**Linha ~340** — fallback de summary de validacao (nao user-facing mas traduzir para consistencia interna):
Manter o fallback em ingles ("Issue requires human review") — esta e uma string de dado interno nao exibida ao usuario, conforme decisao documentada na secao 5.2 do RESEARCH.md. NAO substituir por strings.py.
</action>
<acceptance_criteria>
- `grep -n "Please provide\|Use /report\|Use /status\|Use /list\|Welcome!\|Thank you for your answers\|Invalid report ID\|Invalid rating\|Invalid user\|not found\.\|No results found\|This issue has been escalated\|I'm glad\|I'm sorry the guidance\|User indicated guidance\|Check the knowledge base\|Unknown issue" src/bot/handlers.py` retorna vazio (nenhuma string em ingles user-facing restante)
- `grep -n "from src.bot import strings" src/bot/handlers.py` retorna a linha de import
- `grep -n "strings\." src/bot/handlers.py` retorna no minimo 20 referencias a constantes de strings
- `python -c "import sys; sys.path.insert(0, '.'); import ast; ast.parse(open('src/bot/handlers.py').read()); print('syntax OK')"` imprime "syntax OK"
</acceptance_criteria>
</task>

<task id="2">
<title>Substituir strings hardcoded em escalation/handler.py pelas constantes de strings.py</title>
<read_first>
- src/escalation/handler.py (estrutura atual de format_escalation_message e format_self_service_message — strings nas linhas 133-153, 179-194)
- src/bot/strings.py (constantes: ESCALATION_MESSAGE, ESCALATION_WORKAROUNDS_HEADER, ESCALATION_KNOWN_ISSUES_TIP, ESCALATION_SELF_SERVICE_INTRO, ESCALATION_STEPS_HEADER, ESCALATION_NOT_RESOLVED_FOLLOWUP, DEFAULT_PROJECT_NOT_SPECIFIED, DEFAULT_IMPACT_UNDETERMINED)
</read_first>
<action>
Adicionar import no topo de `src/escalation/handler.py`, apos os imports existentes da stdlib:

```python
from src.bot import strings
```

Reescrever `format_escalation_message()` substituindo todos os literais em ingles pelas constantes de strings.py. Manter a logica condicional de workarounds e known_issues intacta, apenas trocar os literais:

```python
def format_escalation_message(
    self,
    escalation: EscalationData,
    workarounds: Optional[List[str]] = None,
    known_issues: Optional[List[str]] = None,
) -> str:
    lines = [
        strings.ESCALATION_MESSAGE.format(
            issue=escalation.summary,
            project=escalation.project_name or strings.DEFAULT_PROJECT_NOT_SPECIFIED,
            impact=escalation.impact or strings.DEFAULT_IMPACT_UNDETERMINED,
            report_id=escalation.user_report_id,
        ),
    ]

    if workarounds or known_issues:
        lines.append("")
        lines.append(strings.ESCALATION_WORKAROUNDS_HEADER)
        if workarounds:
            for workaround in workarounds:
                lines.append(f"- {workaround}")
        if known_issues:
            lines.append(strings.ESCALATION_KNOWN_ISSUES_TIP)

    return "\n".join(lines)
```

Reescrever `format_self_service_message()` substituindo os literais em ingles:

```python
def format_self_service_message(
    self,
    article_title: str,
    article_content: str,
    guide_steps: List[str],
) -> str:
    lines = [
        strings.ESCALATION_SELF_SERVICE_INTRO,
        "",
        article_title,
        "",
        article_content,
        "",
        strings.ESCALATION_STEPS_HEADER,
    ]

    for i, step in enumerate(guide_steps, start=1):
        lines.append(f"{i}. {step}")

    lines.extend(
        [
            "",
            strings.ESCALATION_NOT_RESOLVED_FOLLOWUP,
        ]
    )

    return "\n".join(lines)
```
</action>
<acceptance_criteria>
- `grep -n "I've analyzed\|I'm escalating\|A human agent\|Your report ID:\|In the meantime:\|You may also want\|I found information\|Steps to resolve:\|please let me know\|I will escalate\|Not specified\|To be determined" src/escalation/handler.py` retorna vazio
- `grep -n "from src.bot import strings" src/escalation/handler.py` retorna a linha de import
- `grep -n "strings\." src/escalation/handler.py` retorna no minimo 8 referencias
- `python -c "import sys; sys.path.insert(0, '.'); import ast; ast.parse(open('src/escalation/handler.py').read()); print('syntax OK')"` imprime "syntax OK"
</acceptance_criteria>
</task>

<verification>
A partir da raiz do projeto:

1. `grep -rn "Please provide\|I've received\|I'm analyzing\|I found information\|Steps to resolve\|Not specified\|To be determined\|I'm glad\|I'm sorry\|User indicated guidance\|Your report ID\|This issue has been escalated\|Great!\|Check the knowledge base\|Unknown issue\|I'm escalating" src/bot/handlers.py src/escalation/handler.py` — deve retornar vazio.
2. `python -c "import sys; sys.path.insert(0, '.'); import ast; [ast.parse(open(f).read()) for f in ['src/bot/handlers.py', 'src/escalation/handler.py']]; print('syntax OK')"` — deve imprimir "syntax OK".
3. `grep -c "strings\." src/bot/handlers.py` — deve retornar >= 20.
4. `grep -c "strings\." src/escalation/handler.py` — deve retornar >= 8.
</verification>

<must_haves>
- Nenhuma string user-facing em ingles permanece em handlers.py ou escalation/handler.py
- Mensagens de erro em pt-br com tom acolhedor e opcao de acao (ex: "use /cancelar", "use /ajuda")
- Logica condicional de workarounds/known_issues em format_escalation_message preservada intacta
- Ambos os arquivos passam parse de sintaxe Python sem erros
</must_haves>
