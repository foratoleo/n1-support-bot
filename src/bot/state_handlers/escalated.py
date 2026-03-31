"""Handler para o estado ESCALATED da conversa."""

from telegram import Update

from src.bot import strings
from src.bot.conversation_manager import ConversationManager, UserConversationState


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado ESCALATED.

    Informa que o chamado já foi escalado e aguarda resolução humana.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    await update.message.reply_text(strings.ESCALATED_STATE_MESSAGE)
