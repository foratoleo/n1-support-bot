"""Handler para o estado AWAITING_VALIDATION_ANSWER da conversa."""

from uuid import UUID

from telegram import Update

from src.bot import strings
from src.bot.templates import format_validation_question
from src.bot.conversation_manager import ConversationManager, ConversationState, UserConversationState
from src.database.connection import get_database_pool
from src.database.repositories import ConversationRepository, EscalationRepository, UserReportRepository
from src.escalation.handler import EscalationHandler
from src.rag.knowledge_base import KnowledgeBaseSearcher
from src.validation.classifier import IssueClassifier
from src.validation.questions import QuestionGenerator


# Instância compartilhada reutilizada
_question_generator = QuestionGenerator()


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado AWAITING_VALIDATION_ANSWER.

    Coleta respostas às perguntas de validação, avança para a próxima pergunta ou
    decide escalar/encaminhar para orientação ao final do questionário.

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    user_id = update.effective_user.id
    user_answer = update.message.text

    validation_questions = user_state.validation_questions
    current_index = user_state.current_question_index

    # Verifica se há perguntas a responder
    if current_index < len(validation_questions):
        question = validation_questions[current_index]
        user_state.validation_answers.append(user_answer)
        user_state.current_question_index += 1

        # Envia próxima pergunta se houver
        if user_state.current_question_index < len(validation_questions):
            next_question = validation_questions[user_state.current_question_index]
            await update.message.reply_text(
                format_validation_question(
                    current=user_state.current_question_index + 1,
                    total=len(validation_questions),
                    question=next_question.get("question", ""),
                )
            )
        else:
            # Todas as perguntas respondidas — analisa e decide próximo passo
            await update.message.reply_text(strings.VALIDATION_ANALYZING)

            pool = get_database_pool()

            async with pool.acquire() as session:
                conv_repo = ConversationRepository(session)

                # Armazena resposta do usuário
                if user_state.current_report_id:
                    await conv_repo.add_message(
                        report_id=UUID(user_state.current_report_id),
                        role="user",
                        message=user_answer,
                    )

                # Analisa respostas de validação
                questions_obj = [
                    _question_generator.get_questions_for_category(
                        user_state.classified_category or "general",
                        max_questions=3,
                    )
                ]
                validation_result = _question_generator.validate_responses(
                    questions_obj[0] if questions_obj else [],
                    user_state.validation_answers,
                )

                # Verifica necessidade de escalação
                classifier = IssueClassifier(
                    openai_client=context.bot_data.get("openai_client"),
                    kb_searcher=KnowledgeBaseSearcher(pool),
                    question_generator=_question_generator,
                )
                escalation_decision = await classifier.should_escalate(
                    issue_description=user_state.issue_description or "",
                    validation_answers=user_state.validation_answers,
                    kb_articles=user_state.kb_articles_found,
                )

                if escalation_decision.should_escalate or validation_result.get("needs_escalation"):
                    # Cria escalação
                    escalation_handler = EscalationHandler(
                        escalation_repo=EscalationRepository(session),
                        user_report_repo=UserReportRepository(session),
                    )

                    escalation = await escalation_handler.create_escalation(
                        report_id=UUID(user_state.current_report_id),
                        summary=escalation_decision.reason or validation_result.get("summary", "Chamado requer análise humana"),
                        project_name=user_state.context.get("project_name"),
                        impact=user_state.context.get("impact"),
                    )

                    # Formata e envia mensagem de escalação
                    escalation_message = escalation_handler.format_escalation_message(escalation)
                    await update.message.reply_text(escalation_message)

                    # Armazena resposta do bot
                    if user_state.current_report_id:
                        await conv_repo.add_message(
                            report_id=UUID(user_state.current_report_id),
                            role="bot",
                            message=escalation_message,
                        )

                    conv_manager.update_user_state(
                        user_id,
                        ConversationState.ESCALATED,
                        escalation_id=escalation.id,
                    )
                else:
                    # Autoatendimento: encaminha para orientação via artigos da KB
                    conv_manager.update_user_state(
                        user_id,
                        ConversationState.PROVIDING_GUIDANCE,
                    )
    else:
        # Sem perguntas de validação configuradas — encaminha para orientação
        conv_manager.update_user_state(
            user_id,
            ConversationState.PROVIDING_GUIDANCE,
        )
