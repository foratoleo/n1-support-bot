"""Handler para o estado AWAITING_FEEDBACK_COMMENT da conversa."""

from telegram import Update

from src.bot.conversation_manager import ConversationManager, UserConversationState


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata texto livre recebido quando o usuário está no estado AWAITING_FEEDBACK_COMMENT.

    Delega ao handler centralizado em feedback_handler.py.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    from src.bot.feedback_handler import handle_feedback_comment_text  # noqa: PLC0415

    await handle_feedback_comment_text(update, context, user_state, conv_manager)
