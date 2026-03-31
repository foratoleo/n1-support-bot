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
