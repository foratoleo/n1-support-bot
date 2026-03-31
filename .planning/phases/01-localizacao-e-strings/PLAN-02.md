---
phase: 1
plan: 2
title: "Migrar src/bot/templates.py para usar strings.py"
wave: 2
depends_on: [1]
files_modified: ["src/bot/templates.py"]
requirements_addressed: ["L10N-01", "L10N-03"]
autonomous: true
estimated_tasks: 2
---

<task id="1">
<title>Substituir BOT_MESSAGES e defaults hardcoded em templates.py pelas constantes de strings.py</title>
<read_first>
- src/bot/templates.py (estrutura atual: BOT_MESSAGES dict, format_* functions, get_confirmation_keyboard)
- src/bot/strings.py (constantes criadas no Plano 1 — verificar nomes exatos antes de referenciar)
</read_first>
<action>
Reescrever `src/bot/templates.py` substituindo todas as strings user-facing por importacoes de `src.bot.strings`.

Passos especificos:

1. Adicionar import no topo do arquivo (apos os imports existentes):
```python
from src.bot import strings
```

2. Substituir o dicionario `BOT_MESSAGES` inteiro por constantes individuais importadas. O dicionario deve ser mantido como alias de compatibilidade temporaria mapeando as chaves originais para as novas constantes — handlers ainda referenciam `BOT_MESSAGES["welcome"]`, `BOT_MESSAGES["help"]`, `BOT_MESSAGES["cancel"]`, `BOT_MESSAGES["error"]`:

```python
# Alias de compatibilidade — remover apos migracao completa de handlers.py (Plano 3)
BOT_MESSAGES = {
    "welcome": strings.WELCOME,
    "help": strings.HELP,
    "acknowledge": strings.REPORT_ACKNOWLEDGED,
    "ask_question": strings.VALIDATION_QUESTION,
    "known_issue": strings.SELF_SERVICE_GUIDANCE,
    "escalate": strings.ESCALATION_MESSAGE,
    "status_format": strings.STATUS_REPORT,
    "cancel": strings.CANCEL,
    "error": strings.ERROR_GENERIC,
    "search_results": strings.SEARCH_RESULTS,
    "no_results": strings.SEARCH_NO_RESULTS,
    "feedback_success": strings.FEEDBACK_SUCCESS,
    "report_list": strings.LIST_HEADER,
    "report_item": strings.LIST_ITEM,
    "confirmation": strings.CONFIRMATION_QUESTION,
}
```

3. Atualizar `format_escalation()` — substituir defaults hardcoded:
```python
def format_escalation(
    report_id: str,
    issue: str,
    project: str = strings.DEFAULT_PROJECT_NOT_SPECIFIED,
    impact: str = strings.DEFAULT_IMPACT_UNDETERMINED,
) -> str:
```

4. Atualizar `format_status_report()` — substituir `"Yes"` e `"No"` hardcoded:
```python
    escalated=strings.STATUS_ESCALATED_YES if escalated else strings.STATUS_ESCALATED_NO,
```

5. Atualizar `format_search_results()` — substituir o template de item inline na linha 179-183:
```python
    for i, r in enumerate(results, 1):
        results_text.append(
            strings.SEARCH_RESULT_ITEM.format(
                index=i,
                title=r["title"],
                area=r["area"],
                excerpt=r["content"][:150],
            )
        )
```

6. Atualizar `get_confirmation_keyboard()` — substituir labels de botoes hardcoded:
```python
    keyboard = [
        [
            InlineKeyboardButton(strings.BTN_YES_RESOLVED, callback_data="yes_resolved"),
            InlineKeyboardButton(strings.BTN_NO_UNRESOLVED, callback_data="no_unresolved"),
        ]
    ]
```
</action>
<acceptance_criteria>
- `grep -n '"Yes, resolved"\|"No, still need help"\|"Not specified"\|"To be determined"' src/bot/templates.py` retorna vazio
- `grep -n "from src.bot import strings" src/bot/templates.py` retorna a linha de import
- `grep -n "strings\.BTN_YES_RESOLVED\|strings\.BTN_NO_UNRESOLVED" src/bot/templates.py` retorna as duas referencias nos botoes
- `grep -n "strings\.STATUS_ESCALATED_YES\|strings\.STATUS_ESCALATED_NO" src/bot/templates.py` retorna a linha em format_status_report
- `grep -n "strings\.DEFAULT_PROJECT_NOT_SPECIFIED\|strings\.DEFAULT_IMPACT_UNDETERMINED" src/bot/templates.py` retorna as duas referencias nos defaults de format_escalation
- `grep -n "strings\.SEARCH_RESULT_ITEM" src/bot/templates.py` retorna a linha em format_search_results
- `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import BOT_MESSAGES, get_confirmation_keyboard, format_escalation, format_status_report; print('OK')"` executa sem erros
</acceptance_criteria>
</task>

<task id="2">
<title>Verificar que format_* functions continuam funcionando corretamente apos migracao</title>
<read_first>
- src/bot/templates.py (versao atualizada pela task 1)
- src/bot/strings.py (constantes usadas)
</read_first>
<action>
Executar verificacao rapida de importacao e chamada das funcoes publicas de templates.py para confirmar que a interface publica nao quebrou.

Verificar que as seguintes chamadas retornam strings nao-vazias e em pt-br:

- `format_acknowledge("test-id")` deve retornar string contendo "Recebi o seu chamado" e "test-id"
- `format_escalation(report_id="abc", issue="erro")` deve retornar string contendo "Analisei" e "Nao informado" (default)
- `format_status_report(report_id="abc", status="open", created_at="01/01/2026", escalated=True)` deve retornar string contendo "Sim" (nao "Yes")
- `format_status_report(..., escalated=False)` deve retornar string contendo "Nao" (nao "No")
- `get_confirmation_keyboard()` deve retornar InlineKeyboardMarkup com botoes "Sim, resolveu" e "Nao, ainda preciso de ajuda"

Nao ha codigo a escrever nesta task — apenas a verificacao confirma que a task 1 esta correta. Se algum retorno ainda exibir texto em ingles, corrigir o mapeamento no BOT_MESSAGES alias ou na funcao correspondente.
</action>
<acceptance_criteria>
- `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import format_acknowledge; msg = format_acknowledge('x'); assert 'Recebi' in msg, msg; print('OK')"` imprime OK
- `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import format_escalation; msg = format_escalation('r','issue'); assert 'Nao informado' in msg, msg; assert 'A determinar' in msg, msg; print('OK')"` imprime OK
- `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import format_status_report; msg = format_status_report('r','open','01/01/2026', True); assert 'Sim' in msg and 'Yes' not in msg, msg; print('OK')"` imprime OK
- `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import get_confirmation_keyboard; kb = get_confirmation_keyboard(); btn_texts = [b.text for row in kb.inline_keyboard for b in row]; assert 'Sim, resolveu' in btn_texts, btn_texts; print('OK')"` imprime OK
</acceptance_criteria>
</task>

<verification>
A partir da raiz do projeto:

1. `grep -rn '"Yes, resolved"\|"No, still need help"\|"Not specified"\|"To be determined"\|"Yes"\|"No"' src/bot/templates.py` — deve retornar vazio (zero ocorrencias de strings em ingles user-facing).
2. `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import BOT_MESSAGES; print(BOT_MESSAGES['welcome'][:20])"` — deve imprimir "Ola! Bem-vindo ao Su".
3. `python -c "import sys; sys.path.insert(0, '.'); from src.bot.templates import get_confirmation_keyboard; kb = get_confirmation_keyboard(); print([b.text for row in kb.inline_keyboard for b in row])"` — deve imprimir `['Sim, resolveu', 'Nao, ainda preciso de ajuda']`.
</verification>

<must_haves>
- BOT_MESSAGES alias mantido para nao quebrar handlers.py enquanto o Plano 3 nao for executado
- Nenhuma string hardcoded em ingles permanece em templates.py (botoes, defaults, labels de status)
- Interface publica das funcoes format_* inalterada (mesmos parametros e tipos de retorno)
- Arquivo importa sem erros com `from src.bot.templates import BOT_MESSAGES`
</must_haves>
