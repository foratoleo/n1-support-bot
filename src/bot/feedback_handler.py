"""Handler de feedback inline automático — Fase 10 (FBK-01 a FBK-03).

Registra os callbacks com prefixo "fbk:" para o ciclo completo:
  fbk:rate:{report_id}:{stars}  → registra rating e pergunta se quer comentário
  fbk:comment:{report_id}:yes   → define estado AWAITING_FEEDBACK_COMMENT
  fbk:comment:{report_id}:no    → agradece e encerra
  fbk:skip:{report_id}          → pula feedback graciosamente

O feedback é NON-BLOCKING: se o usuário ignorar o prompt e iniciar nova ação,
a nova ação é processada normalmente pelo state_handlers.
"""

from __future__ import annotations

import logging
from uuid import UUID

from telegram import Update

from src.bot.callback_router import register
from src.bot.conversation_manager import ConversationManager, ConversationState
from src.bot import strings
from src.bot.keyboards import (
    get_feedback_comment_keyboard,
    get_main_menu_keyboard,
)
from src.database.connection import get_database_pool
from src.database.repositories import UserReportRepository

logger = logging.getLogger(__name__)


def _get_conv_manager() -> ConversationManager:
    """Retorna a instância global do ConversationManager de handlers.py."""
    from src.bot.handlers import conv_manager  # noqa: PLC0415
    return conv_manager


async def send_feedback_prompt(update_or_query, report_id: str) -> None:
    """Envia o prompt de feedback com teclado de estrelas após a conclusão de um fluxo.

    Pode ser chamado a partir de qualquer handler que conclua um fluxo.
    Envia uma nova mensagem (não edita), garantindo que seja não-bloqueante:
    o usuário pode ignorar e iniciar nova ação sem problemas.

    Args:
        update_or_query: Objeto Update ou CallbackQuery do Telegram.
        report_id: UUID completo do chamado recém-criado/resolvido.
    """
    from src.bot.keyboards import get_feedback_rating_keyboard  # noqa: PLC0415

    keyboard = get_feedback_rating_keyboard(report_id)

    # Suporta tanto Update quanto CallbackQuery como origem
    if hasattr(update_or_query, "message") and update_or_query.message:
        await update_or_query.message.reply_text(
            strings.FBK_PROMPT,
            reply_markup=keyboard,
        )
    elif hasattr(update_or_query, "effective_message") and update_or_query.effective_message:
        await update_or_query.effective_message.reply_text(
            strings.FBK_PROMPT,
            reply_markup=keyboard,
        )


async def send_feedback_prompt_after_edit(query, report_id: str) -> None:
    """Envia o prompt de feedback como nova mensagem após edit_message_text.

    Para usar em fluxos que terminam com query.edit_message_text.

    Args:
        query: CallbackQuery do Telegram (já respondido).
        report_id: UUID completo do chamado.
    """
    from src.bot.keyboards import get_feedback_rating_keyboard  # noqa: PLC0415

    keyboard = get_feedback_rating_keyboard(report_id)
    try:
        await query.message.reply_text(
            strings.FBK_PROMPT,
            reply_markup=keyboard,
        )
    except Exception as exc:
        logger.warning("Falha ao enviar prompt de feedback: %s", exc)


# ---------------------------------------------------------------------------
# Handlers de callback "fbk:"
# ---------------------------------------------------------------------------


@register("fbk:")
async def handle_fbk_callback(update: Update, context) -> None:
    """Despachante de callbacks com prefixo 'fbk:' — ciclo de feedback.

    Ações:
    - fbk:rate:{rid}:{stars}     → grava rating, pergunta sobre comentário
    - fbk:comment:{rid}:yes      → define estado AWAITING_FEEDBACK_COMMENT
    - fbk:comment:{rid}:no       → agradece e volta ao menu
    - fbk:skip:{rid}             → pula graciosamente e volta ao menu

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    data: str = query.data or ""
    suffix = data[len("fbk:"):]  # remove prefixo "fbk:"

    if suffix.startswith("rate:"):
        # formato: rate:{rid}:{stars}
        parts = suffix[len("rate:"):].rsplit(":", 1)
        if len(parts) == 2:
            report_id_short, stars_str = parts
            await _handle_fbk_rate(query, update, report_id_short, stars_str)

    elif suffix.startswith("comment:"):
        # formato: comment:{rid}:yes|no
        parts = suffix[len("comment:"):].rsplit(":", 1)
        if len(parts) == 2:
            report_id_short, choice = parts
            await _handle_fbk_comment_choice(query, update, report_id_short, choice)

    elif suffix.startswith("skip:"):
        report_id_short = suffix[len("skip:"):]
        await _handle_fbk_skip(query, update, report_id_short)


async def _handle_fbk_rate(
    query, update: Update, report_id_short: str, stars_str: str
) -> None:
    """Registra o rating (1-5) no banco e pergunta se quer deixar comentário.

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        report_id_short: Primeiros 8 chars do UUID do chamado.
        stars_str: String "1"-"5" representando o rating.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()

    try:
        stars = int(stars_str)
        if stars < 1 or stars > 5:
            raise ValueError("Rating fora do intervalo permitido")
    except ValueError:
        logger.warning("Rating inválido recebido: %s", stars_str)
        await query.edit_message_text(
            text=strings.FEEDBACK_INVALID_RATING,
            reply_markup=get_main_menu_keyboard(),
        )
        return

    # Tenta gravar no banco usando match parcial do UUID
    await _persist_rating(report_id_short, stars, user_id)

    # Armazena o report_id_short e rating no contexto para uso posterior
    user_state = conv_manager.get_user_state(user_id)
    user_state.context["fbk_report_id"] = report_id_short
    user_state.context["fbk_stars"] = stars

    # Edita mensagem para mostrar agradecimento + pergunta sobre comentário
    await query.edit_message_text(
        text=f"{strings.FBK_THANKS}\n\n{strings.FBK_COMMENT_ASK}",
        reply_markup=get_feedback_comment_keyboard(report_id_short),
    )


async def _handle_fbk_comment_choice(
    query, update: Update, report_id_short: str, choice: str
) -> None:
    """Trata a escolha Sim/Não para deixar comentário.

    Se Sim: define estado AWAITING_FEEDBACK_COMMENT e aguarda texto livre.
    Se Não: agradece e retorna ao menu principal.

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        report_id_short: Primeiros 8 chars do UUID do chamado.
        choice: "yes" ou "no".
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()

    if choice == "yes":
        user_state = conv_manager.get_user_state(user_id)
        user_state.context["fbk_report_id"] = report_id_short
        conv_manager.update_user_state(
            user_id, ConversationState.AWAITING_FEEDBACK_COMMENT
        )
        await query.edit_message_text(text=strings.FBK_COMMENT_PROMPT)
    else:
        conv_manager.update_user_state(user_id, ConversationState.IDLE)
        await query.edit_message_text(
            text=strings.FBK_SKIPPED,
            reply_markup=get_main_menu_keyboard(),
        )


async def _handle_fbk_skip(
    query, update: Update, report_id_short: str
) -> None:
    """Trata o botão Pular — encerra o ciclo de feedback graciosamente.

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        report_id_short: Primeiros 8 chars do UUID do chamado (ignorado).
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    conv_manager.update_user_state(user_id, ConversationState.IDLE)

    await query.edit_message_text(
        text=strings.FBK_SKIPPED,
        reply_markup=get_main_menu_keyboard(),
    )


async def _persist_rating(
    report_id_short: str, stars: int, user_id: int
) -> None:
    """Tenta gravar o rating no banco usando busca por prefixo de UUID.

    Falhas são registradas em log mas não propagadas (feedback não-bloqueante).

    Args:
        report_id_short: Primeiros 8 chars do UUID do chamado.
        stars: Rating de 1 a 5.
        user_id: ID do usuário Telegram (para log).
    """
    try:
        pool = get_database_pool()
        async with pool.acquire() as session:
            from sqlalchemy import select, text  # noqa: PLC0415
            from src.database.models import UserReport  # noqa: PLC0415

            # Busca UUID que comece com o prefixo informado
            stmt = select(UserReport).where(
                text("CAST(id AS TEXT) LIKE :prefix")
            ).params(prefix=f"{report_id_short}%")
            result = await session.execute(stmt)
            report = result.scalar_one_or_none()

            if report:
                repo = UserReportRepository(session)
                await repo.update_rating(report.id, stars)
                logger.info(
                    "Rating %d gravado para chamado %s (user_id=%s)",
                    stars,
                    report.id,
                    user_id,
                )
            else:
                logger.warning(
                    "Chamado não encontrado para rating (prefix=%s, user_id=%s)",
                    report_id_short,
                    user_id,
                )
    except Exception as exc:
        logger.warning(
            "Falha ao gravar rating para %s (user_id=%s): %s",
            report_id_short,
            user_id,
            exc,
        )


async def handle_feedback_comment_text(
    update, context, user_state, conv_manager
) -> None:
    """Handler de texto livre para o estado AWAITING_FEEDBACK_COMMENT.

    Salva o comentário no contexto (log), agradece ao usuário e retorna ao IDLE.
    Chamado pelo state_handlers dispatcher quando o estado é AWAITING_FEEDBACK_COMMENT.

    Args:
        update: Objeto Update do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    user_id = update.effective_user.id
    comment_text = update.message.text or ""
    report_id_short = user_state.context.get("fbk_report_id", "")
    stars = user_state.context.get("fbk_stars", 0)

    logger.info(
        "Comentário de feedback recebido (report=%s, stars=%s, user=%s): %s",
        report_id_short,
        stars,
        user_id,
        comment_text[:100],
    )

    conv_manager.update_user_state(user_id, ConversationState.IDLE)

    await update.message.reply_text(
        text=strings.FBK_COMMENT_THANKS,
        reply_markup=get_main_menu_keyboard(),
    )
