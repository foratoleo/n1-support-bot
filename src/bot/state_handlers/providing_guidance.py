"""Handler para o estado PROVIDING_GUIDANCE da conversa."""

from uuid import UUID

from telegram import Update

from src.bot import strings
from src.bot.templates import format_self_service, format_escalation
from src.bot.keyboards import get_confirmation_keyboard
from src.bot.conversation_manager import ConversationManager, ConversationState, UserConversationState
from src.database.connection import get_database_pool
from src.database.repositories import ConversationRepository


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado PROVIDING_GUIDANCE.

    Apresenta orientação de autoatendimento baseada nos artigos da KB encontrados
    ou escala o chamado caso não haja artigos disponíveis.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    user_id = update.effective_user.id
    pool = get_database_pool()

    async with pool.acquire() as session:
        conv_repo = ConversationRepository(session)

        # Armazena mensagem do usuário
        if user_state.current_report_id:
            await conv_repo.add_message(
                report_id=UUID(user_state.current_report_id),
                role="user",
                message=update.message.text,
            )

        if user_state.kb_articles_found:
            article = user_state.kb_articles_found[0]
            summary = article[1] if len(article) > 1 else ""
            steps = [strings.DEFAULT_SELF_SERVICE_STEP]

            guidance_message = format_self_service(summary=summary, steps=steps)
            keyboard = get_confirmation_keyboard()
            await update.message.reply_text(guidance_message, reply_markup=keyboard)

            # Armazena resposta do bot
            if user_state.current_report_id:
                await conv_repo.add_message(
                    report_id=UUID(user_state.current_report_id),
                    role="bot",
                    message=guidance_message,
                )
        else:
            # Nenhum artigo da KB encontrado — escala o chamado
            escalation_message = format_escalation(
                report_id=user_state.current_report_id or "UNKNOWN",
                issue=user_state.issue_description or strings.DEFAULT_ISSUE_DESCRIPTION,
            )
            await update.message.reply_text(escalation_message)

            if user_state.current_report_id:
                await conv_repo.add_message(
                    report_id=UUID(user_state.current_report_id),
                    role="bot",
                    message=escalation_message,
                )

            conv_manager.update_user_state(
                user_id,
                ConversationState.ESCALATED,
            )
