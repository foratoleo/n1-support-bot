"""Bot response templates for N1 Support Bot."""

from typing import Optional, List

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from src.bot import strings

# Alias de compatibilidade — remover apos migracao completa de handlers.py (Plano 3)
BOT_MESSAGES = {
    "welcome": strings.WELCOME,
    "help": strings.HELP,
    "acknowledge": strings.REPORT_ACKNOWLEDGED,
    "ask_question": strings.VALIDATION_QUESTION,
    "known_issue": strings.SELF_SERVICE_GUIDANCE,
    "escalate": strings.ESCALATION_MESSAGE,
    "status_format": strings.STATUS_REPORT,
    "cancel": strings.CANCEL,
    "error": strings.ERROR_GENERIC,
    "search_results": strings.SEARCH_RESULTS,
    "no_results": strings.SEARCH_NO_RESULTS,
    "feedback_success": strings.FEEDBACK_SUCCESS,
    "report_list": strings.LIST_HEADER,
    "report_item": strings.LIST_ITEM,
    "confirmation": strings.CONFIRMATION_QUESTION,
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
    project: str = strings.DEFAULT_PROJECT_NOT_SPECIFIED,
    impact: str = strings.DEFAULT_IMPACT_UNDETERMINED,
) -> str:
    """Format the escalation message with issue details.

    Args:
        report_id: The unique report identifier.
        issue: Description of the issue.
        project: Project name (default: strings.DEFAULT_PROJECT_NOT_SPECIFIED).
        impact: Impact level (default: strings.DEFAULT_IMPACT_UNDETERMINED).

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
        escalated=strings.STATUS_ESCALATED_YES if escalated else strings.STATUS_ESCALATED_NO,
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
            strings.SEARCH_RESULT_ITEM.format(
                index=i,
                title=r["title"],
                area=r["area"],
                excerpt=r["content"][:150],
            )
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
        rating_text = f"\n  Avaliação: {r['rating']}/5" if r.get("rating") else ""
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
            InlineKeyboardButton(strings.BTN_YES_RESOLVED, callback_data="yes_resolved"),
            InlineKeyboardButton(strings.BTN_NO_UNRESOLVED, callback_data="no_unresolved"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)
