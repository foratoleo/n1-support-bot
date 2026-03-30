"""Telegram command and message handlers for N1 Support Bot."""

from uuid import UUID

from telegram import Update
from telegram.ext import CommandHandler, MessageHandler, filters

from src.database.connection import get_database_pool
from src.database.repositories import (
    ConversationRepository,
    EscalationRepository,
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
)


# Global conversation manager instance
conv_manager = ConversationManager()

# Shared instances for reuse within a session
question_generator = QuestionGenerator()


async def start_command(update: Update, context) -> None:
    """Handle /start command.

    Args:
        update: The Telegram update object.
        context: The callback context.
    """
    await update.message.reply_text(BOT_MESSAGES["welcome"])


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
        await update.message.reply_text(
            "Please provide an issue description. Usage: /report <your issue>"
        )
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
        await update.message.reply_text(
            "Please provide a report ID. Usage: /status <report_id>"
        )
        return

    report_id = context.args[0]

    pool = get_database_pool()

    try:
        report_uuid = UUID(report_id)
    except ValueError:
        await update.message.reply_text(
            "Invalid report ID format. Please provide a valid UUID."
        )
        return

    async with pool.acquire() as session:
        user_report_repo = UserReportRepository(session)
        escalation_repo = EscalationRepository(session)

        report = await user_report_repo.get_by_id(report_uuid)

        if not report:
            await update.message.reply_text(
                f"Report {report_id} not found."
            )
            return

        escalation = await escalation_repo.get_by_report(report_uuid)

        created_at = (
            report.created_at.strftime("%d/%m/%Y %H:%M:%S")
            if report.created_at
            else "Unknown"
        )

        await update.message.reply_text(
            format_status_report(
                report_id=report_id,
                status=report.status or "Unknown",
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
    # Null check for non-text messages
    if not update.message.text:
        await update.message.reply_text("Please send a text response.")
        return

    user_id = update.effective_user.id
    user_state = conv_manager.get_user_state(user_id)

    if user_state.state == ConversationState.IDLE:
        await update.message.reply_text(
            "Welcome! Use /report <issue> to report a problem or /help for available commands."
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
                await update.message.reply_text(
                    "Thank you for your answers. I'm analyzing your issue..."
                )

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
                            summary=escalation_decision.reason or validation_result.get("summary", "Issue requires human review"),
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
                steps = ["Check the knowledge base article for resolution steps."]

                guidance_message = format_self_service(summary=summary, steps=steps)
                await update.message.reply_text(guidance_message)

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
                    issue=user_state.issue_description or "Unknown issue",
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
        await update.message.reply_text(
            "This issue has been escalated to our support team. "
            "You'll be notified when there's an update. Use /status <report_id> to check progress."
        )
        return

    await update.message.reply_text(BOT_MESSAGES["error"])


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
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )
