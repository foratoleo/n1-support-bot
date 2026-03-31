"""Handlers concretos de CallbackQuery registrados no callback_router.

Cada função é decorada com @register(prefix) e atende callbacks cujo
callback_data começa com o prefixo informado.

Este módulo é importado automaticamente por callback_router.py ao final
da sua inicialização, garantindo que todos os handlers sejam registrados
antes que qualquer CallbackQuery chegue.
"""

from uuid import UUID

from telegram import Update

from src.bot.callback_router import register
from src.bot.conversation_manager import ConversationManager, ConversationState
from src.bot import strings
from src.bot.keyboards import (
    get_main_menu_keyboard,
    get_back_to_menu_keyboard,
    get_duvidas_submenu_keyboard,
    get_erro_submenu_keyboard,
    get_category_keyboard,
    get_kb_category_list_keyboard,
    format_breadcrumb,
)
from src.database.connection import get_database_pool
from src.database.repositories import EscalationRepository, UserReportRepository
from src.escalation.handler import EscalationHandler


# Instância compartilhada do gerenciador de conversas.
# Importada do módulo handlers para manter consistência de estado.
# Importação lazy para evitar circular imports — obtida via função auxiliar.
def _get_conv_manager() -> ConversationManager:
    """Retorna a instância global do ConversationManager de handlers.py."""
    from src.bot.handlers import conv_manager  # noqa: PLC0415
    return conv_manager


# ---------------------------------------------------------------------------
# Handler: confirmação positiva (problema resolvido)
# ---------------------------------------------------------------------------


@register("yes_resolved")
async def handle_yes_resolved(update: Update, context) -> None:
    """Trata o callback 'yes_resolved' — usuário confirmou que o problema foi resolvido.

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    await query.edit_message_text(text=strings.CALLBACK_RESOLVED)

    if user_state and user_state.current_report_id:
        pool = get_database_pool()
        async with pool.acquire() as session:
            user_report_repo = UserReportRepository(session)
            await user_report_repo.update_status(
                UUID(user_state.current_report_id), "resolved"
            )

    conv_manager.update_user_state(user_id, ConversationState.IDLE)


# ---------------------------------------------------------------------------
# Handler: confirmação negativa (problema não resolvido)
# ---------------------------------------------------------------------------


@register("no_unresolved")
async def handle_no_unresolved(update: Update, context) -> None:
    """Trata o callback 'no_unresolved' — usuário informou que o problema persiste.

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    await query.edit_message_text(text=strings.CALLBACK_NOT_RESOLVED)

    if user_state and user_state.current_report_id:
        pool = get_database_pool()
        async with pool.acquire() as session:
            escalation_handler = EscalationHandler(
                escalation_repo=EscalationRepository(session),
                user_report_repo=UserReportRepository(session),
            )
            await escalation_handler.create_escalation(
                report_id=UUID(user_state.current_report_id),
                summary=strings.CALLBACK_ESCALATION_SUMMARY,
            )

    conv_manager.update_user_state(user_id, ConversationState.ESCALATED)


# ---------------------------------------------------------------------------
# Handler: busca inline (prefixo "search")
# ---------------------------------------------------------------------------


@register("search")
async def handle_search_callback(update: Update, context) -> None:
    """Trata callbacks com prefixo 'search' originados de botões de busca inline.

    Atualmente um stub — será expandido na Fase 7 (navegação pela KB).

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    # Placeholder: callbacks de busca serão implementados na Fase 7.
    # A presença deste handler garante que o router reconheça o prefixo "search"
    # sem lançar erro nem cair no fallback silencioso.
    pass


# ---------------------------------------------------------------------------
# Handler: feedback inline (prefixo "feedback")
# ---------------------------------------------------------------------------


@register("feedback")
async def handle_feedback_callback(update: Update, context) -> None:
    """Trata callbacks com prefixo 'feedback' originados de botões de avaliação inline.

    Atualmente um stub — será expandido na Fase 10 (feedback automático).

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    # Placeholder: callbacks de feedback serão implementados na Fase 10.
    pass


# ---------------------------------------------------------------------------
# Handlers: menu principal (prefixo "menu:")
# ---------------------------------------------------------------------------


@register("menu:")
async def handle_menu_callback(update: Update, context) -> None:
    """Trata todos os callbacks com prefixo 'menu:' — navegação pelo menu principal.

    Despacha para sub-handlers com base no sufixo do callback_data:
    - menu:main        → retorna ao menu principal (NAV-04)
    - menu:duvidas     → placeholder "Em breve" com botão voltar
    - menu:erro        → placeholder "Em breve" com botão voltar
    - menu:chamado     → status do chamado mais recente do usuário
    - menu:humano      → fluxo de escalação para humano

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    data: str = query.data or ""
    action = data[len("menu:") :]  # sufixo após "menu:"

    if action == "main":
        await _handle_menu_main(query)
    elif action == "duvidas":
        await _handle_menu_duvidas(query, update)
    elif action == "duvidas:acesso":
        await _handle_menu_duvidas_categoria(query, update, "acesso")
    elif action == "duvidas:documentos":
        await _handle_menu_duvidas_categoria(query, update, "documentos")
    elif action == "duvidas:tarefas":
        await _handle_menu_duvidas_categoria(query, update, "tarefas")
    elif action == "duvidas:geral":
        await _handle_menu_duvidas_categoria(query, update, "geral")
    elif action == "erro":
        await _handle_menu_erro(query, update)
    elif action == "chamado":
        await _handle_menu_chamado(query, update)
    elif action == "humano":
        await _handle_menu_humano(query, update, context)
    # Ações não reconhecidas são silenciosamente ignoradas (router já respondeu query.answer)


async def _handle_menu_main(query) -> None:
    """Retorna ao menu principal editando a mensagem atual (NAV-04)."""
    from src.bot import strings as _strings
    await query.edit_message_text(
        text=_strings.MENU_WELCOME,
        reply_markup=get_main_menu_keyboard(),
    )


async def _handle_menu_duvidas(query, update: Update) -> None:
    """Exibe o submenu de categorias da KB (KB-01).

    Empurra "duvidas" na pilha de navegação e edita a mensagem atual
    com a listagem de categorias da base de conhecimento navegável.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    user_state.push_menu("duvidas")

    await query.edit_message_text(
        text=strings.MENU_DUVIDAS_INTRO,
        reply_markup=get_kb_category_list_keyboard(),
    )


async def _handle_menu_duvidas_categoria(
    query, update: Update, categoria: str
) -> None:
    """Exibe o conteúdo de uma categoria de dúvida (NAV-03).

    Empurra a categoria na pilha de navegação e edita a mensagem com
    a orientação correspondente.

    Args:
        query: Objeto CallbackQuery do Telegram.
        update: Objeto Update do Telegram.
        categoria: Identificador da categoria ("acesso", "documentos", "tarefas", "geral").
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    user_state.push_menu(f"duvidas:{categoria}")

    _cat_texts = {
        "acesso": strings.MENU_CAT_ACESSO,
        "documentos": strings.MENU_CAT_DOCUMENTOS,
        "tarefas": strings.MENU_CAT_TAREFAS,
        "geral": strings.MENU_CAT_GERAL,
    }
    text = _cat_texts.get(categoria, strings.MENU_CAT_GERAL)

    await query.edit_message_text(
        text=text,
        reply_markup=get_category_keyboard(),
    )


async def _handle_menu_erro(query, update: Update) -> None:
    """Inicia o wizard guiado de report de erro (Fase 6).

    Empurra "erro" na pilha de navegação e delega ao report_wizard.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    user_state.push_menu("erro")

    from src.bot.report_wizard import start_report_wizard  # noqa: PLC0415
    await start_report_wizard(query, update)


async def _handle_menu_chamado(query, update: Update) -> None:
    """Exibe o status do chamado mais recente do usuário.

    Se não houver chamados, informa o usuário e oferece retorno ao menu.
    """
    user_id = update.effective_user.id
    pool = get_database_pool()

    breadcrumb = format_breadcrumb(strings.BTN_ACOMPANHAR_CHAMADO)

    async with pool.acquire() as session:
        from uuid import UUID as _UUID
        user_report_repo = UserReportRepository(session)
        try:
            user_uuid = _UUID(int=user_id)
            reports = await user_report_repo.get_recent_by_user(user_uuid, limit=1)
        except (ValueError, Exception):
            reports = []

    if not reports:
        text = (
            f"{breadcrumb}\n\n"
            "Você ainda não tem chamados abertos.\n"
            "Use o menu para reportar um erro ou tirar uma dúvida."
        )
    else:
        report = reports[0]
        created_at = (
            report.created_at.strftime("%d/%m/%Y %H:%M")
            if report.created_at
            else "Desconhecido"
        )
        text = (
            f"{breadcrumb}\n\n"
            f"Chamado mais recente:\n"
            f"• ID: {str(report.id)[:8]}...\n"
            f"• Status: {report.status or 'Desconhecido'}\n"
            f"• Criado em: {created_at}"
        )

    await query.edit_message_text(
        text=text,
        reply_markup=get_back_to_menu_keyboard(),
    )


async def _handle_menu_humano(query, update: Update, context) -> None:  # noqa: D401
    """Inicia o fluxo de escalação para atendimento humano."""
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    breadcrumb = format_breadcrumb(strings.BTN_FALAR_HUMANO)

    if user_state.current_report_id:
        pool = get_database_pool()
        async with pool.acquire() as session:
            escalation_handler = EscalationHandler(
                escalation_repo=EscalationRepository(session),
                user_report_repo=UserReportRepository(session),
            )
            await escalation_handler.create_escalation(
                report_id=UUID(user_state.current_report_id),
                summary="Usuário solicitou atendimento humano pelo menu principal.",
            )

        conv_manager.update_user_state(user_id, ConversationState.ESCALATED)
        text = (
            f"{breadcrumb}\n\n"
            "Seu chamado foi encaminhado para a equipe de suporte.\n"
            "Um agente irá responder em breve."
        )
    else:
        text = (
            f"{breadcrumb}\n\n"
            f"{strings.MENU_HUMANO_INICIANDO}\n\n"
            "Para abrir um chamado, use o menu para descrever seu problema primeiro."
        )

    await query.edit_message_text(
        text=text,
        reply_markup=get_back_to_menu_keyboard(),
    )


# ---------------------------------------------------------------------------
# Handler: navegação — prefixo "nav:" (NAV-03)
# ---------------------------------------------------------------------------


@register("nav:")
async def handle_nav_callback(update: Update, context) -> None:
    """Trata callbacks com prefixo 'nav:' — ações de navegação entre níveis de menu.

    Ações suportadas:
    - nav:back → recua para o nível pai na pilha de menu_path e re-renderiza.

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    data: str = query.data or ""
    action = data[len("nav:"):]

    if action == "back":
        await _handle_nav_back(query, update)


async def _handle_nav_back(query, update: Update) -> None:
    """Recua um nível na árvore de navegação usando pop_menu (NAV-03).

    Mapeia o nó pai resultante para o teclado e texto corretos,
    editando a mensagem sem enviar nova mensagem ao chat.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    # Remove o nó atual; o que sobra é o pai.
    user_state.pop_menu()
    parent = user_state.current_menu()

    # Mapeamento nó-pai → (texto, teclado)
    if parent in ("duvidas",):
        text = strings.MENU_DUVIDAS_INTRO
        keyboard = get_kb_category_list_keyboard()
    elif parent in ("erro",):
        text = strings.MENU_ERRO_INTRO
        keyboard = get_erro_submenu_keyboard()
    elif parent and parent.startswith("kb:cat:"):
        # Voltando de um artigo → retorna para listagem de artigos da categoria
        category = parent[len("kb:cat:"):]
        from src.bot.kb_browser import _get_articles_by_category, _CATEGORY_LABELS  # noqa: PLC0415
        from src.bot.keyboards import get_kb_article_list_keyboard  # noqa: PLC0415
        articles = await _get_articles_by_category(category)
        category_label = _CATEGORY_LABELS.get(category, category)
        text = strings.KB_CATEGORY_HEADER.format(category=category_label)
        article_buttons = [(art_id, title) for art_id, title, _area in articles]
        keyboard = get_kb_article_list_keyboard(article_buttons, category)
    else:
        # Raiz ou nó desconhecido → menu principal
        user_state.clear_menu()
        text = strings.MENU_WELCOME
        keyboard = get_main_menu_keyboard()

    await query.edit_message_text(text=text, reply_markup=keyboard)
