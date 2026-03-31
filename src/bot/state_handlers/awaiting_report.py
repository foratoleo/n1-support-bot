"""Handler para o estado AWAITING_REPORT da conversa."""

from telegram import Update

from src.bot.templates import BOT_MESSAGES
from src.bot.conversation_manager import ConversationManager, UserConversationState


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado AWAITING_REPORT.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    # Estado sem lógica adicional — usa fallback genérico de erro
    await update.message.reply_text(BOT_MESSAGES["error"])
