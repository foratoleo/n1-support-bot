"""Telegram command and message handlers for N1 Support Bot."""

from uuid import UUID

from telegram import Update
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CommandHandler, MessageHandler, CallbackQueryHandler, filters

from src.database.connection import get_database_pool
from src.database.repositories import (
    ConversationRepository,
    EscalationRepository,
    KBDocumentRepository,
    UserReportRepository,
)
from src.escalation.handler import EscalationHandler
from src.rag.knowledge_base import KnowledgeBaseSearcher
from src.validation.classifier import IssueClassifier
from src.validation.questions import QuestionGenerator

from .conversation_manager import ConversationManager, ConversationState, UserConversationState
from .templates import (
    BOT_MESSAGES,
    format_acknowledge,
    format_escalation,
    format_self_service,
    format_validation_question,
    format_status_report,
    format_search_results,
    format_feedback,
    format_report_list,
)
from .keyboards import get_confirmation_keyboard, get_main_menu_keyboard
from .callback_router import route_callback
from src.bot import strings


# Global conversation manager instance
conv_manager = ConversationManager()

# Shared instances for reuse within a session
question_generator = QuestionGenerator()


async def start_command(update: Update, context) -> None:
    """Handle /start command.

    Exibe imediatamente o menu principal com InlineKeyboard.
    Não requer leitura de instruções — o usuário navega por botões (NAV-01).

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    user_id = update.effective_user.id
    conv_manager.clear_user_state(user_id)
    await update.message.reply_text(
        strings.MENU_WELCOME,
        reply_markup=get_main_menu_keyboard(),
    )


async def help_command(update: Update, context) -> None:
    """Handle /help command.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    await update.message.reply_text(BOT_MESSAGES["help"])


async def cancel_command(update: Update, context) -> None:
    """Handle /cancel command.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    user_id = update.effective_user.id
    conv_manager.clear_user_state(user_id)
    await update.message.reply_text(BOT_MESSAGES["cancel"])


async def report_command(update: Update, context) -> None:
    """Handle /report <issue> command.

    Extracts the issue from command arguments, creates a user report
    in the database, updates conversation state, searches KB for
    relevant articles, classifies the issue, and asks the first
    validation question.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    user_id = update.effective_user.id

    if not context.args:
        await update.message.reply_text(strings.REPORT_MISSING_ARGS)
        return

    issue_description = " ".join(context.args)

    pool = get_database_pool()

    async with pool.acquire() as session:
        user_report_repo = UserReportRepository(session)
        conv_repo = ConversationRepository(session)

        # Create real database record
        report = await user_report_repo.create(
            description=issue_description,
            user_id=UUID(int=user_id) if user_id else None,
        )

        # Store user message
        await conv_repo.add_message(
            report_id=report.id,
            role="user",
            message=issue_description,
        )

        # Search KB for relevant articles
        kb_searcher = KnowledgeBaseSearcher(pool)
        articles = await kb_searcher.find_relevant_articles(
            issue_description=issue_description,
            limit=3,
        )

        # Classify the issue
        classifier = IssueClassifier(
                        openai_client=context.bot_data.get("openai_client"),
            kb_searcher=kb_searcher,
            question_generator=question_generator,
        )
        classification = await classifier.classify(issue_description)

        # Get validation questions based on classification
        questions = question_generator.get_questions_for_category(
            classification.category,
            max_questions=3,
        )
        question_dicts = [
            {"id": q.id, "question": q.text, "options": q.options}
            for q in questions
        ]

        # Store bot acknowledgment
        ack_message = format_acknowledge(str(report.id))
        await conv_repo.add_message(
            report_id=report.id,
            role="bot",
            message=ack_message,
        )

    # Update conversation state
    kb_tuples = [(title, content, area) for title, content, area in articles]

    conv_manager.update_user_state(
        user_id,
        ConversationState.AWAITING_VALIDATION_ANSWER,
        current_report_id=str(report.id),
        issue_description=issue_description,
        classified_category=classification.category,
        validation_questions=question_dicts,
        current_question_index=0,
        validation_answers=[],
        kb_articles_found=kb_tuples,
    )

    # Send first validation question
    if question_dicts:
        await update.message.reply_text(
            format_validation_question(
                current=1,
                total=len(question_dicts),
                question=question_dicts[0]["question"],
            )
        )
    else:
        # No questions for this category, move to guidance directly
        conv_manager.update_user_state(
            user_id,
            ConversationState.PROVIDING_GUIDANCE,
        )


async def status_command(update: Update, context) -> None:
    """Handle /status <report_id> command.

    Looks up the report by ID and returns its status with formatting.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    if not context.args:
        await update.message.reply_text(strings.STATUS_MISSING_ARGS)
        return

    report_id = context.args[0]

    pool = get_database_pool()

    try:
        report_uuid = UUID(report_id)
    except ValueError:
        await update.message.reply_text(strings.STATUS_INVALID_ID)
        return

    async with pool.acquire() as session:
        user_report_repo = UserReportRepository(session)
        escalation_repo = EscalationRepository(session)

        report = await user_report_repo.get_by_id(report_uuid)

        if not report:
            await update.message.reply_text(strings.STATUS_NOT_FOUND.format(report_id=report_id))
            return

        escalation = await escalation_repo.get_by_report(report_uuid)

        created_at = (
            report.created_at.strftime("%d/%m/%Y %H:%M:%S")
            if report.created_at
            else "Desconhecido"
        )

        await update.message.reply_text(
            format_status_report(
                report_id=report_id,
                status=report.status or "Desconhecido",
                created_at=created_at,
                escalated=escalation is not None,
            )
        )


async def handle_message(update: Update, context) -> None:
    """Main message handler for non-command messages.

    Orchestrates the full flow:
    1. Get user state
    2. Based on state, process the message
    3. Store message in conversations
    4. Update state accordingly

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    user_id = update.effective_user.id
    user_state = conv_manager.get_user_state(user_id)

    # COLLECTING_REPORT: aceita texto livre ou foto como detalhe opcional (RPT-05)
    if user_state.state == ConversationState.COLLECTING_REPORT:
        wizard = user_state.menu_context.get("rpt_wizard", {})
        if wizard.get("step") == "details":
            from src.bot.keyboards import get_report_confirm_keyboard  # noqa: PLC0415
            from src.bot import strings as _strings  # noqa: PLC0415
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
        return

    # Null check for non-text messages (após COLLECTING_REPORT para aceitar fotos)
    if not update.message or not update.message.text:
        await update.message.reply_text(strings.NON_TEXT_MESSAGE)
        return

    # KB-07: busca por keyword quando usuário digitou após "Pesquisar na KB"
    if user_state.state == ConversationState.AWAITING_KB_SEARCH:
        await _handle_kb_search_message(update, user_id, user_state)
        return

    if user_state.state == ConversationState.IDLE:
        # NAV-06: texto livre fora de fluxo ativo exibe o menu principal
        await update.message.reply_text(
            strings.FREE_TEXT_REDIRECT,
            reply_markup=get_main_menu_keyboard(),
        )
        return

    if user_state.state == ConversationState.AWAITING_VALIDATION_ANSWER:
        user_answer = update.message.text

        validation_questions = user_state.validation_questions
        current_index = user_state.current_question_index

        # Check if there are more questions to ask
        if current_index < len(validation_questions):
            question = validation_questions[current_index]
            user_state.validation_answers.append(user_answer)
            user_state.current_question_index += 1

            # Ask next question
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
                # All questions answered, analyze and decide next step
                await update.message.reply_text(strings.VALIDATION_ANALYZING)

                # Perform validation and escalation analysis
                pool = get_database_pool()

                async with pool.acquire() as session:
                    conv_repo = ConversationRepository(session)

                    # Store user answer
                    if user_state.current_report_id:
                        await conv_repo.add_message(
                            report_id=UUID(user_state.current_report_id),
                            role="user",
                            message=user_answer,
                        )

                    # Analyze validation responses
                    questions_obj = [
                        question_generator.get_questions_for_category(
                            user_state.classified_category or "general",
                            max_questions=3,
                        )
                    ]
                    validation_result = question_generator.validate_responses(
                        questions_obj[0] if questions_obj else [],
                        user_state.validation_answers,
                    )

                    # Check if should escalate
                    classifier = IssueClassifier(
                        openai_client=context.bot_data.get("openai_client"),
                        kb_searcher=KnowledgeBaseSearcher(pool),
                        question_generator=question_generator,
                    )
                    escalation_decision = await classifier.should_escalate(
                        issue_description=user_state.issue_description or "",
                        validation_answers=user_state.validation_answers,
                        kb_articles=user_state.kb_articles_found,
                    )

                    if escalation_decision.should_escalate or validation_result.get("needs_escalation"):
                        # Create escalation
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

                        # Format and send escalation message
                        escalation_message = escalation_handler.format_escalation_message(escalation)
                        await update.message.reply_text(escalation_message)

                        # Store bot response
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
                        # Self-service: provide guidance from KB articles
                        conv_manager.update_user_state(
                            user_id,
                            ConversationState.PROVIDING_GUIDANCE,
                        )
        else:
            # No validation questions configured, move to guidance
            conv_manager.update_user_state(
                user_id,
                ConversationState.PROVIDING_GUIDANCE,
            )
        return

    if user_state.state == ConversationState.PROVIDING_GUIDANCE:
        pool = get_database_pool()

        async with pool.acquire() as session:
            conv_repo = ConversationRepository(session)

            # Store user message
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

                # Store bot response
                if user_state.current_report_id:
                    await conv_repo.add_message(
                        report_id=UUID(user_state.current_report_id),
                        role="bot",
                        message=guidance_message,
                    )
            else:
                # No KB articles found, escalate
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
        return

    if user_state.state == ConversationState.ESCALATED:
        await update.message.reply_text(strings.ESCALATED_STATE_MESSAGE)
        return

    await update.message.reply_text(BOT_MESSAGES["error"])



async def _handle_kb_search_message(update: Update, user_id: int, user_state) -> None:
    """Processa busca por keyword na KB quando o usuário está no estado AWAITING_KB_SEARCH.

    Realiza busca BM25 com o texto digitado e exibe artigos como botões inline.

    Args:
        update: The Telegram update object.
        user_id: ID do usuário Telegram.
        user_state: Estado de conversa atual do usuário.
    """
    query_text = update.message.text.strip()
    pool = get_database_pool()

    kb_searcher = KnowledgeBaseSearcher(pool)
    results = await kb_searcher.find_relevant_articles(
        issue_description=query_text,
        limit=5,
    )

    conv_manager.update_user_state(user_id, ConversationState.IDLE)

    if not results:
        from src.bot.keyboards import get_kb_category_list_keyboard  # noqa: PLC0415
        await update.message.reply_text(
            strings.KB_SEARCH_NO_RESULTS.format(query=query_text),
            reply_markup=get_kb_category_list_keyboard(),
        )
        return

    from src.database.repositories import KBDocumentRepository  # noqa: PLC0415
    from src.bot.keyboards import get_kb_article_list_keyboard  # noqa: PLC0415

    # Busca IDs dos artigos encontrados para montar os botões
    article_buttons: list[tuple[str, str]] = []
    async with pool.acquire() as session:
        repo = KBDocumentRepository(session)
        for title, _content, area in results:
            # Busca pelo título exato para obter o ID
            docs = await repo.search(query=title, area=area, limit=1)
            if docs:
                article_buttons.append((str(docs[0].id), docs[0].title))

    if not article_buttons:
        await update.message.reply_text(
            strings.KB_SEARCH_NO_RESULTS.format(query=query_text),
        )
        return

    header = strings.KB_SEARCH_RESULTS_HEADER.format(query=query_text)
    await update.message.reply_text(
        text=header,
        reply_markup=get_kb_article_list_keyboard(article_buttons, "geral"),
    )


async def search_command(update: Update, context) -> None:
    """Handle /search <query> command.

    Searches the KB directly and returns results to the user.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    if not context.args:
        await update.message.reply_text(strings.SEARCH_MISSING_ARGS)
        return

    query = " ".join(context.args)
    pool = get_database_pool()

    async with pool.acquire() as session:
        kb_repo = KBDocumentRepository(session)
        articles = await kb_repo.search(query=query, limit=5)

        if not articles:
            await update.message.reply_text(strings.SEARCH_NO_RESULTS.format(query=query))
            return

        results_text = format_search_results(query, [
            {"title": a.title, "content": a.content[:200] + "..." if len(a.content) > 200 else a.content, "area": a.area}
            for a in articles
        ])
        await update.message.reply_text(results_text, parse_mode="Markdown")


async def list_command(update: Update, context) -> None:
    """Handle /list command.

    Shows user's recent reports (last 5) with status.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    user_id = update.effective_user.id
    pool = get_database_pool()

    try:
        user_uuid = UUID(int=user_id)
    except ValueError:
        await update.message.reply_text(strings.LIST_INVALID_USER)
        return

    async with pool.acquire() as session:
        user_report_repo = UserReportRepository(session)
        reports = await user_report_repo.get_recent_by_user(user_uuid, limit=5)

        if not reports:
            await update.message.reply_text(strings.LIST_NO_REPORTS)
            return

        reports_data = []
        for r in reports:
            created_at = r.created_at.strftime("%d/%m/%Y %H:%M") if r.created_at else "Desconhecido"
            reports_data.append({
                "id": str(r.id),
                "description": r.description[:50] + "..." if len(r.description) > 50 else r.description,
                "status": r.status or "Desconhecido",
                "created_at": created_at,
                "rating": r.rating if r.rating else None,
            })

        list_text = format_report_list(reports_data)
        await update.message.reply_text(list_text, parse_mode="Markdown")


async def feedback_command(update: Update, context) -> None:
    """Handle /feedback <report_id> <1-5> command.

    Allows user to rate if their issue was resolved.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    if len(context.args) < 2:
        await update.message.reply_text(strings.FEEDBACK_MISSING_ARGS)
        return

    report_id = context.args[0]
    rating_str = context.args[1]

    try:
        rating = int(rating_str)
        if rating < 1 or rating > 5:
            raise ValueError("Rating must be between 1 and 5")
    except ValueError:
        await update.message.reply_text(strings.FEEDBACK_INVALID_RATING)
        return

    pool = get_database_pool()

    try:
        report_uuid = UUID(report_id)
    except ValueError:
        await update.message.reply_text(strings.FEEDBACK_INVALID_ID)
        return

    async with pool.acquire() as session:
        user_report_repo = UserReportRepository(session)
        success = await user_report_repo.update_rating(report_uuid, rating)

        if not success:
            await update.message.reply_text(strings.FEEDBACK_NOT_FOUND.format(report_id=report_id))
            return

        feedback_text = format_feedback(report_id, rating)
        await update.message.reply_text(feedback_text)


async def button_callback(update: Update, context) -> None:
    """Alias mantido para compatibilidade retroativa.

    O despacho real é feito por ``route_callback`` em ``callback_router.py``.
    Este wrapper garante que código legado que referencia ``button_callback``
    continue funcionando sem alterações.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    await route_callback(update, context)



def register_handlers(application) -> None:
    """Register all handlers with the PTB application.

    Args:
        application: The python-telegram-bot Application instance.
    """
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("cancel", cancel_command))
    application.add_handler(CommandHandler("report", report_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("search", search_command))
    application.add_handler(CommandHandler("list", list_command))
    application.add_handler(CommandHandler("feedback", feedback_command))
    application.add_handler(CallbackQueryHandler(route_callback))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )
    # RPT-05: aceitar fotos durante a etapa de detalhes do wizard de report
    application.add_handler(
        MessageHandler(filters.PHOTO, handle_message)
    )
