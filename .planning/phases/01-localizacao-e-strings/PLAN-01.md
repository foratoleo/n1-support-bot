---
phase: 1
plan: 1
title: "Criar modulo src/bot/strings.py com todas as constantes pt-br"
wave: 1
depends_on: []
files_modified: ["src/bot/strings.py"]
requirements_addressed: ["L10N-01", "L10N-03", "L10N-04"]
autonomous: true
estimated_tasks: 1
---

<task id="1">
<title>Criar src/bot/strings.py com ~40 constantes UPPER_SNAKE_CASE em pt-br</title>
<read_first>
- src/bot/templates.py (inventariar BOT_MESSAGES e labels de botoes inline existentes)
- src/bot/handlers.py (identificar strings hardcoded fora de BOT_MESSAGES)
- src/escalation/handler.py (identificar strings user-facing em format_escalation_message e format_self_service_message)
</read_first>
<action>
Criar o arquivo `src/bot/strings.py` com o seguinte conteudo exato:

```python
"""Strings centralizadas do bot em pt-br com tom profissional cordial."""

# ---------------------------------------------------------------------------
# Comandos basicos
# ---------------------------------------------------------------------------

WELCOME = (
    "Olá! Bem-vindo ao Suporte N1 do Workforce. "
    "Estou aqui para ajudar você a resolver dúvidas ou reportar problemas no sistema. "
    "Use /ajuda para ver os comandos disponíveis."
)

HELP = (
    "Comandos disponíveis:\n"
    "/start - Iniciar uma nova conversa\n"
    "/ajuda - Exibir esta mensagem de ajuda\n"
    "/report <descrição> - Reportar um problema\n"
    "/status <id_chamado> - Consultar o status de um chamado\n"
    "/buscar <termo> - Buscar na base de conhecimento\n"
    "/lista - Ver seus chamados recentes\n"
    "/feedback <id_chamado> <1-5> - Avaliar um chamado\n"
    "/cancelar - Cancelar a conversa atual"
)

CANCEL = (
    "Conversa encerrada. Se precisar de ajuda novamente, "
    "use /report para abrir um novo chamado."
)

ERROR_GENERIC = (
    "Ocorreu um problema inesperado. "
    "Por favor, tente novamente ou use /cancelar para recomeçar."
)

# ---------------------------------------------------------------------------
# Idle / redirecionamento
# ---------------------------------------------------------------------------

IDLE_REDIRECT = (
    "Olá! Para reportar um problema, use /report <descrição>. "
    "Para ver os comandos disponíveis, use /ajuda."
)

NON_TEXT_MESSAGE = "Por favor, envie uma mensagem de texto."

# ---------------------------------------------------------------------------
# Fluxo de report
# ---------------------------------------------------------------------------

REPORT_MISSING_ARGS = (
    "Por favor, descreva o problema. "
    "Exemplo de uso: /report <descrição do problema>"
)

REPORT_ACKNOWLEDGED = (
    "Recebi o seu chamado. Vou fazer algumas perguntas para entender melhor o problema.\n\n"
    "Número do chamado: {report_id}"
)

VALIDATION_QUESTION = (
    "Pergunta {current} de {total}:\n"
    "{question}\n\n"
    "Por favor, responda abaixo."
)

VALIDATION_ANALYZING = (
    "Obrigado pelas suas respostas. Estou analisando o problema..."
)

# ---------------------------------------------------------------------------
# Orientacao por base de conhecimento
# ---------------------------------------------------------------------------

SELF_SERVICE_GUIDANCE = (
    "Encontrei informações relacionadas ao seu problema na base de conhecimento.\n\n"
    "{summary}\n\n"
    "Passos para resolver:\n"
    "{steps}\n\n"
    "Se isso não resolver o problema, me avise e abrirei um chamado com a equipe de suporte."
)

CONFIRMATION_QUESTION = "Isso resolveu o seu problema?"

# ---------------------------------------------------------------------------
# Escalacao
# ---------------------------------------------------------------------------

ESCALATION_MESSAGE = (
    "Analisei o seu problema e identifiquei que ele requer atendimento humano.\n\n"
    "Resumo:\n"
    "- Problema: {issue}\n"
    "- Projeto: {project}\n"
    "- Impacto: {impact}\n\n"
    "Vou encaminhar para a equipe de suporte. Um agente irá analisar e responder em breve.\n\n"
    "Número do chamado: {report_id}"
)

ESCALATION_WORKAROUNDS_HEADER = "Enquanto isso:"
ESCALATION_KNOWN_ISSUES_TIP = (
    "- Você também pode consultar nossa base de problemas conhecidos"
)

ESCALATED_STATE_MESSAGE = (
    "Este chamado já foi encaminhado para a equipe de suporte. "
    "Você será notificado quando houver uma atualização. "
    "Use /status <id_chamado> para acompanhar o progresso."
)

ESCALATION_SELF_SERVICE_INTRO = (
    "Encontrei informações sobre este problema na base de conhecimento."
)

ESCALATION_STEPS_HEADER = "Passos para resolver:"

ESCALATION_NOT_RESOLVED_FOLLOWUP = (
    "Se isso não resolver o problema, me avise e encaminharei para um agente humano."
)

# ---------------------------------------------------------------------------
# Callbacks inline
# ---------------------------------------------------------------------------

CALLBACK_RESOLVED = (
    "Que ótimo! Fico feliz em ter ajudado. "
    "Caso precise de suporte novamente, estou à disposição. "
    "Use /lista para ver seus chamados anteriores."
)

CALLBACK_NOT_RESOLVED = (
    "Lamento que a orientação não tenha resolvido o problema. "
    "Vou encaminhar para a equipe de suporte para uma análise mais detalhada. "
    "Use /status <id_chamado> para acompanhar o progresso."
)

CALLBACK_ESCALATION_SUMMARY = "Usuário informou que a orientação não resolveu o problema"

# ---------------------------------------------------------------------------
# Botoes inline
# ---------------------------------------------------------------------------

BTN_YES_RESOLVED = "Sim, resolveu"
BTN_NO_UNRESOLVED = "Não, ainda preciso de ajuda"

# ---------------------------------------------------------------------------
# Status de chamado
# ---------------------------------------------------------------------------

STATUS_REPORT = (
    "Status do Chamado\n\n"
    "Número: {report_id}\n"
    "Status: {status}\n"
    "Criado em: {created_at}\n"
    "Escalado: {escalated}"
)

STATUS_ESCALATED_YES = "Sim"
STATUS_ESCALATED_NO = "Não"

STATUS_MISSING_ARGS = (
    "Por favor, informe o número do chamado. "
    "Exemplo de uso: /status <id_chamado>"
)

STATUS_INVALID_ID = (
    "Formato de ID inválido. Por favor, informe um UUID válido."
)

STATUS_NOT_FOUND = "Chamado {report_id} não encontrado."

# ---------------------------------------------------------------------------
# Busca
# ---------------------------------------------------------------------------

SEARCH_MISSING_ARGS = (
    "Por favor, informe o termo de busca. "
    "Exemplo de uso: /buscar <termo>"
)

SEARCH_RESULTS = "Resultados para '{query}':\n\n{results}"

SEARCH_NO_RESULTS = (
    "Nenhum resultado encontrado para: {query}\n\n"
    "Tente palavras-chave diferentes ou use /report para abrir um chamado."
)

SEARCH_RESULT_ITEM = "*{index}. {title}*\n   Área: {area}\n   {excerpt}"

# ---------------------------------------------------------------------------
# Lista de chamados
# ---------------------------------------------------------------------------

LIST_NO_REPORTS = (
    "Você ainda não tem chamados. "
    "Use /report <descrição> para criar o primeiro."
)

LIST_HEADER = "Seus Chamados Recentes:\n\n{reports}"

LIST_ITEM = (
    "• [{status}] {description}\n"
    "  ID: `{report_id}`\n"
    "  Criado em: {created_at}{rating_text}\n"
)

LIST_INVALID_USER = "ID de usuário inválido."

# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

FEEDBACK_MISSING_ARGS = (
    "Por favor, informe o número do chamado e a avaliação (1-5). "
    "Exemplo de uso: /feedback <id_chamado> <1-5>"
)

FEEDBACK_INVALID_RATING = (
    "Avaliação inválida. Por favor, informe um número entre 1 e 5."
)

FEEDBACK_INVALID_ID = (
    "Formato de ID inválido. Por favor, informe um UUID válido."
)

FEEDBACK_NOT_FOUND = "Chamado {report_id} não encontrado."

FEEDBACK_SUCCESS = (
    "Obrigado pela sua avaliação! Chamado {report_id} avaliado com {rating}/5.\n\n"
    "Agradecemos o seu feedback para melhorarmos o serviço."
)

# ---------------------------------------------------------------------------
# Valores padrao internos (fallbacks em format_escalation e format_self_service)
# ---------------------------------------------------------------------------

DEFAULT_PROJECT_NOT_SPECIFIED = "Não informado"
DEFAULT_IMPACT_UNDETERMINED = "A determinar"
DEFAULT_SELF_SERVICE_STEP = (
    "Consulte o artigo da base de conhecimento para os passos de resolução."
)
DEFAULT_ESCALATION_SUMMARY = "Chamado requer análise humana"
DEFAULT_ISSUE_DESCRIPTION = "Sem descrição"
```
</action>
<acceptance_criteria>
- `grep -r "def " src/bot/strings.py` retorna vazio (arquivo so tem constantes, sem funcoes)
- `grep "^WELCOME" src/bot/strings.py` retorna a linha com a constante
- `grep "^BTN_YES_RESOLVED" src/bot/strings.py` retorna `BTN_YES_RESOLVED = "Sim, resolveu"`
- `grep "^BTN_NO_UNRESOLVED" src/bot/strings.py` retorna `BTN_NO_UNRESOLVED = "Não, ainda preciso de ajuda"`
- `grep "Welcome\|Sorry\|Thank you\|Please\|I've\|I'm\|I will\|I found\|Your report\|In the meantime\|Steps to resolve\|Not specified\|To be determined" src/bot/strings.py` retorna vazio (nenhuma string em ingles)
- `python -c "import sys; sys.path.insert(0, '.'); from src.bot.strings import WELCOME, ESCALATION_MESSAGE, BTN_YES_RESOLVED; print('OK')"` executa sem erros
</acceptance_criteria>
</task>

<verification>
Executar a partir da raiz do projeto:

1. `python -c "import sys; sys.path.insert(0, '.'); import src.bot.strings as s; attrs = [a for a in dir(s) if not a.startswith('_')]; print(len(attrs), 'constants'); print('OK')"` — deve imprimir 40+ constants e OK.
2. `grep -E "(Welcome|Sorry|Thank you|Please provide|I've received|I'm analyzing|I found information|Steps to resolve|Not specified|To be determined|Your report ID)" src/bot/strings.py` — deve retornar vazio (zero linhas em ingles).
3. `grep "Sim, resolveu\|Não, ainda preciso\|Obrigado\|Olá!\|Recebi\|Analisei\|Você será\|Chamado requer" src/bot/strings.py` — deve retornar multiplas linhas com strings em pt-br.
</verification>

<must_haves>
- O arquivo src/bot/strings.py existe e importa sem erro
- Todas as ~40 constantes usam UPPER_SNAKE_CASE
- Zero strings em ingles visiveis ao usuario (grep por "Welcome", "Sorry", "Please", "I've", "I'm", "Thank you", "Steps to resolve", "Not specified" retorna vazio)
- Constantes com variaveis usam placeholders {nome} compativeis com .format()
- Tom profissional cordial em pt-br: tratamento por "você", sem girias, mensagens de erro oferecem acao
</must_haves>
