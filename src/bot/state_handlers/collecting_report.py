"""Handler para o estado COLLECTING_REPORT da conversa."""

from telegram import Update

from src.bot.conversation_manager import ConversationManager, UserConversationState


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado COLLECTING_REPORT.

    Aceita texto livre ou foto como detalhe opcional do wizard de report (RPT-05).
    Avança o wizard para a etapa de confirmação após capturar os detalhes.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    wizard = user_state.menu_context.get("rpt_wizard", {})
    if wizard.get("step") == "details":
        from src.bot.keyboards import get_report_confirm_keyboard  # noqa: PLC0415
        from src.bot.report_wizard import _build_confirmation_text  # noqa: PLC0415

        # Captura texto ou foto
        if update.message and update.message.photo:
            # Armazena o file_id da maior resolução
            photo = update.message.photo[-1]
            wizard["photo_id"] = photo.file_id
            wizard["details"] = "[Foto anexada]"
        elif update.message and update.message.text:
            wizard["details"] = update.message.text

        wizard["step"] = "confirm"
        await update.message.reply_text(
            text=_build_confirmation_text(wizard),
            reply_markup=get_report_confirm_keyboard(),
        )
