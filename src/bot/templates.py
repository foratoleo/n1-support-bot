"""Bot response templates for N1 Support Bot."""

from typing import Optional, List

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

BOT_MESSAGES = {
    "welcome": (
        "Welcome to N1 Support Bot! I'm here to help you with issues in the workforce system. "
        "I can help you resolve problems, answer questions, and escalate bugs to our support team."
    ),
    "help": (
        "Available commands:\n"
        "/start - Start a new conversation\n"
        "/help - Show this help message\n"
        "/report <issue> - Report an issue\n"
        "/status <report_id> - Check report status\n"
        "/search <query> - Search knowledge base\n"
        "/list - Show your recent reports\n"
        "/feedback <report_id> <1-5> - Rate a report\n"
        "/cancel - Cancel current conversation"
    ),
    "acknowledge": (
        "I've received your issue. Let me analyze it and ask a few questions to better understand the problem.\n\n"
        "Your report ID is: {report_id}"
    ),
    "ask_question": (
        "Question {current}/{total}:\n"
        "{question}\n\n"
        "Please answer below."
    ),
    "known_issue": (
        "I found information about this in our knowledge base.\n\n"
        "{summary}\n\n"
        "Steps to resolve:\n"
        "{steps}\n\n"
        "If this does not resolve your issue, please let me know."
    ),
    "escalate": (
        "I've analyzed your issue and identified a potential problem that requires human investigation.\n\n"
        "Summary:\n"
        "- Issue: {issue}\n"
        "- Project: {project}\n"
        "- Impact: {impact}\n\n"
        "I'm escalating this to our support team. A human agent will review and respond shortly.\n\n"
        "Your report ID: {report_id}"
    ),
    "status_format": (
        "Report Status\n\n"
        "Report ID: {report_id}\n"
        "Status: {status}\n"
        "Created: {created_at}\n"
        "Escalated: {escalated}"
    ),
    "cancel": "Conversation cancelled. If you have another issue, use /report to start a new conversation.",
    "error": "Sorry, something went wrong. Please try again or use /cancel to start over.",
    "search_results": "Search results for '{query}':\n\n{results}",
    "no_results": "No results found for '{query}'.\n\nTry different keywords or /report to create a support ticket.",
    "feedback_success": "Thank you for your feedback! Report {report_id} rated {rating}/5.\n\nWe appreciate your input to improve our service.",
    "report_list": "Your Recent Reports:\n\n{reports}",
    "report_item": "• [{status}] {description}\n  ID: `{report_id}`\n  Created: {created_at}{rating_text}\n",
    "confirmation": "Did this resolve your issue?",
}


def get_message(key: str, **kwargs) -> str:
    """Get and format a message template.

    Args:
        key: The message key to retrieve.
        **kwargs: Format arguments for the message template.

    Returns:
        Formatted message string or empty string if key not found.
    """
    return BOT_MESSAGES.get(key, "").format(**kwargs)


def format_acknowledge(report_id: str) -> str:
    """Format the acknowledgment message with report ID.

    Args:
        report_id: The unique report identifier.

    Returns:
        Formatted acknowledgment message.
    """
    return get_message("acknowledge", report_id=report_id)


def format_escalation(
    report_id: str,
    issue: str,
    project: str = "Not specified",
    impact: str = "To be determined",
) -> str:
    """Format the escalation message with issue details.

    Args:
        report_id: The unique report identifier.
        issue: Description of the issue.
        project: Project name (default: "Not specified").
        impact: Impact level (default: "To be determined").

    Returns:
        Formatted escalation message.
    """
    return get_message("escalate", report_id=report_id, issue=issue, project=project, impact=impact)


def format_self_service(summary: str, steps: List[str]) -> str:
    """Format a self-service resolution message.

    Args:
        summary: Summary of the known issue.
        steps: List of resolution steps.

    Returns:
        Formatted self-service message with numbered steps.
    """
    steps_text = "\n".join(f"{i+1}. {s}" for i, s in enumerate(steps))
    return get_message("known_issue", summary=summary, steps=steps_text)


def format_validation_question(current: int, total: int, question: str) -> str:
    """Format a validation question message.

    Args:
        current: Current question number.
        total: Total number of questions.
        question: The question text.

    Returns:
        Formatted validation question message.
    """
    return get_message("ask_question", current=current, total=total, question=question)


def format_status_report(
    report_id: str,
    status: str,
    created_at: str,
    escalated: bool,
) -> str:
    """Format a status report message.

    Args:
        report_id: The unique report identifier.
        status: Current status of the report.
        created_at: Creation timestamp.
        escalated: Whether the report has been escalated.

    Returns:
        Formatted status report message.
    """
    return get_message(
        "status_format",
        report_id=report_id,
        status=status,
        created_at=created_at,
        escalated="Yes" if escalated else "No",
    )

def format_search_results(query: str, results: List[dict]) -> str:
    """Format search results message.

    Args:
        query: The search query.
        results: List of result dictionaries with title, content, area.

    Returns:
        Formatted search results message.
    """
    if not results:
        return BOT_MESSAGES["no_results"].format(query=query)

    results_text = []
    for i, r in enumerate(results, 1):
        results_text.append(
            f"*{i}. {r['title']}*\n"
            f"   Area: {r['area']}\n"
            f"   {r['content'][:150]}..."
        )

    return BOT_MESSAGES["search_results"].format(
        query=query,
        results="\n\n".join(results_text)
    )


def format_feedback(report_id: str, rating: int) -> str:
    """Format feedback confirmation message.

    Args:
        report_id: The unique report identifier.
        rating: Rating value (1-5).

    Returns:
        Formatted feedback message.
    """
    return BOT_MESSAGES["feedback_success"].format(report_id=report_id, rating=rating)


def format_report_list(reports: List[dict]) -> str:
    """Format a list of user reports.

    Args:
        reports: List of report dictionaries.

    Returns:
        Formatted report list message.
    """
    reports_text = []
    for r in reports:
        rating_text = f"\n  Rating: {r['rating']}/5" if r.get("rating") else ""
        reports_text.append(
            BOT_MESSAGES["report_item"].format(
                status=r["status"],
                description=r["description"],
                report_id=r["id"],
                created_at=r["created_at"],
                rating_text=rating_text,
            )
        )

    return BOT_MESSAGES["report_list"].format(reports="\n".join(reports_text))


def get_confirmation_keyboard() -> InlineKeyboardMarkup:
    """Get inline keyboard with yes/no confirmation buttons.

    Returns:
        InlineKeyboardMarkup with Yes and No buttons.
    """
    keyboard = [
        [
            InlineKeyboardButton("Yes, resolved", callback_data="yes_resolved"),
            InlineKeyboardButton("No, still need help", callback_data="no_unresolved"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)
