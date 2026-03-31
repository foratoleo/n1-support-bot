"""Pacote de handlers por estado de conversa.

Exporta o dicionário ``DISPATCHER`` que mapeia cada ``ConversationState``
para a função ``handle`` do módulo correspondente, e a função ``dispatch``
que delega a execução ao handler correto.

Uso:
    from src.bot.state_handlers import dispatch
    await dispatch(update, context, user_state, conv_manager)
"""

from src.bot.conversation_manager import ConversationState

from . import (
    idle,
    awaiting_report,
    awaiting_validation,
    providing_guidance,
    escalated,
    collecting_report,
    awaiting_kb_search,
)


DISPATCHER: dict = {
    ConversationState.IDLE: idle.handle,
    ConversationState.AWAITING_REPORT: awaiting_report.handle,
    ConversationState.AWAITING_VALIDATION_ANSWER: awaiting_validation.handle,
    ConversationState.PROVIDING_GUIDANCE: providing_guidance.handle,
    ConversationState.ESCALATED: escalated.handle,
    ConversationState.COLLECTING_REPORT: collecting_report.handle,
    ConversationState.AWAITING_KB_SEARCH: awaiting_kb_search.handle,
}


async def dispatch(update, context, user_state, conv_manager) -> None:
    """Despacha a mensagem para o handler do estado atual do usuário.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    from src.bot.templates import BOT_MESSAGES  # noqa: PLC0415

    handler = DISPATCHER.get(user_state.state)
    if handler:
        await handler(update, context, user_state, conv_manager)
    else:
        await update.message.reply_text(BOT_MESSAGES["error"])
