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

# ---------------------------------------------------------------------------
# Menu principal (Fase 4)
# ---------------------------------------------------------------------------

MENU_WELCOME = "Olá! Sou o assistente de suporte do Workforce. Como posso ajudar?"

BTN_TIRAR_DUVIDA = "Tirar Dúvida"
BTN_REPORTAR_ERRO = "Reportar Erro"
BTN_ACOMPANHAR_CHAMADO = "Acompanhar Chamado"
BTN_FALAR_HUMANO = "Falar com Humano"
BTN_MENU_PRINCIPAL = "Menu Principal"

BREADCRUMB_ROOT = "Suporte Workforce"

FREE_TEXT_REDIRECT = "Não entendi. Use o menu abaixo para navegar:"

MENU_PLACEHOLDER_DUVIDAS = (
    "Suporte Workforce > Tirar Dúvida\n\n"
    "Esta funcionalidade será implementada em breve."
)

MENU_PLACEHOLDER_ERRO = (
    "Suporte Workforce > Reportar Erro\n\n"
    "Esta funcionalidade será implementada em breve."
)

MENU_HUMANO_INICIANDO = (
    "Suporte Workforce > Falar com Humano\n\n"
    "Encaminhando para um agente humano. Aguarde um momento."
)

# ---------------------------------------------------------------------------
# Navegação — Fase 5 (NAV-03)
# ---------------------------------------------------------------------------

BTN_VOLTAR = "« Voltar"

BTN_CAT_ACESSO = "Acesso e Login"
BTN_CAT_DOCUMENTOS = "Geração de Documentos"
BTN_CAT_TAREFAS = "Tarefas e Sprints"
BTN_CAT_GERAL = "Suporte Geral"

SUBMENU_ESCOLHA = "Escolha uma opção:"

MENU_DUVIDAS_INTRO = (
    "Suporte Workforce > Tirar Dúvida\n\n"
    "Selecione a categoria da sua dúvida:"
)

MENU_ERRO_INTRO = (
    "Suporte Workforce > Reportar Erro\n\n"
    "Selecione o tipo de erro que deseja reportar:"
)

MENU_CAT_ACESSO = (
    "Suporte Workforce > Tirar Dúvida > Acesso e Login\n\n"
    "Descreva a sua dúvida sobre acesso ou login no Workforce. "
    "Use /report <descrição> para abrir um chamado."
)

MENU_CAT_DOCUMENTOS = (
    "Suporte Workforce > Tirar Dúvida > Geração de Documentos\n\n"
    "Descreva a sua dúvida sobre geração de documentos no Workforce. "
    "Use /report <descrição> para abrir um chamado."
)

MENU_CAT_TAREFAS = (
    "Suporte Workforce > Tirar Dúvida > Tarefas e Sprints\n\n"
    "Descreva a sua dúvida sobre tarefas ou sprints no Workforce. "
    "Use /report <descrição> para abrir um chamado."
)

MENU_CAT_GERAL = (
    "Suporte Workforce > Tirar Dúvida > Suporte Geral\n\n"
    "Descreva a sua dúvida. "
    "Use /report <descrição> para abrir um chamado."
)

# ---------------------------------------------------------------------------
# Wizard de report de erro — Fase 6 (RPT-01 a RPT-11)
# ---------------------------------------------------------------------------

RPT_BREADCRUMB = "Suporte Workforce > Reportar Erro"

RPT_STEP_AREA = (
    "Suporte Workforce > Reportar Erro\n\n"
    "Qual área do Workforce está com problema?"
)

RPT_STEP_SYMPTOM = (
    "Suporte Workforce > Reportar Erro > {area}\n\n"
    "Qual tipo de problema você está enfrentando?"
)

RPT_STEP_WHEN = (
    "Suporte Workforce > Reportar Erro > {area}\n\n"
    "Quando esse problema começou?"
)

RPT_STEP_FREQUENCY = (
    "Suporte Workforce > Reportar Erro > {area}\n\n"
    "Com que frequência isso acontece?"
)

RPT_STEP_DETAILS = (
    "Suporte Workforce > Reportar Erro > {area}\n\n"
    "Deseja adicionar detalhes ou screenshot? (Opcional — envie texto, foto ou toque em Pular)"
)

RPT_STEP_CONFIRM = "Suporte Workforce > Reportar Erro > Confirmação\n\nConfirme os dados do chamado:"

RPT_CONFIRM_TEMPLATE = (
    "Suporte Workforce > Reportar Erro > Confirmação\n\n"
    "Confirme os dados do chamado:\n\n"
    "Área: {area}\n"
    "Problema: {symptom}\n"
    "Quando: {when}\n"
    "Frequência: {frequency}\n"
    "Detalhes: {details}"
)

RPT_CREATED = (
    "Chamado #{report_id} criado com sucesso!\n\n"
    "Use /status {report_id} para acompanhar o andamento."
)

RPT_DUPLICATE_FOUND = (
    "Encontramos um chamado similar:\n\n"
    "{duplicate_title}\n\n"
    "Isso já resolve o seu problema?"
)

RPT_DUPLICATE_YES = "Sim, é isso mesmo"
RPT_DUPLICATE_NO = "Não, meu problema é diferente"

# Botões do wizard
BTN_PULAR = "Pular"
BTN_CONFIRMAR = "Confirmar Envio"
BTN_CORRIGIR = "Corrigir Dados"

# Opções de área
BTN_AREA_ACESSO = "Acesso e Login"
BTN_AREA_DOCUMENTOS = "Geração de Documentos"
BTN_AREA_TAREFAS = "Tarefas e Sprints"
BTN_AREA_GERAL = "Suporte Geral"

# Opções de sintoma por área
BTN_SYMPTOM_ACESSO_1 = "Não consigo fazer login"
BTN_SYMPTOM_ACESSO_2 = "Senha incorreta ou expirada"
BTN_SYMPTOM_ACESSO_3 = "Conta bloqueada"
BTN_SYMPTOM_ACESSO_4 = "Erro de autenticação 2FA"

BTN_SYMPTOM_DOCUMENTOS_1 = "Documento não é gerado"
BTN_SYMPTOM_DOCUMENTOS_2 = "Documento gerado com erro"
BTN_SYMPTOM_DOCUMENTOS_3 = "Template não encontrado"
BTN_SYMPTOM_DOCUMENTOS_4 = "Erro ao exportar"

BTN_SYMPTOM_TAREFAS_1 = "Tarefa não aparece no board"
BTN_SYMPTOM_TAREFAS_2 = "Não consigo criar tarefa"
BTN_SYMPTOM_TAREFAS_3 = "Sprint não atualiza"
BTN_SYMPTOM_TAREFAS_4 = "Dados desapareceram"

BTN_SYMPTOM_GERAL_1 = "Página não carrega"
BTN_SYMPTOM_GERAL_2 = "Botão não funciona"
BTN_SYMPTOM_GERAL_3 = "Erro inesperado na tela"
BTN_SYMPTOM_GERAL_4 = "Outro problema"

# Opções de quando
BTN_WHEN_TODAY = "Hoje"
BTN_WHEN_YESTERDAY = "Ontem"
BTN_WHEN_DAYS_AGO = "Há mais de 2 dias"
BTN_WHEN_UNKNOWN = "Não sei"

# Opções de frequência
BTN_FREQ_ALWAYS = "Sempre"
BTN_FREQ_SOMETIMES = "Às vezes"
BTN_FREQ_ONCE = "Só uma vez"
BTN_FREQ_INTERMITTENT = "Intermitente"
