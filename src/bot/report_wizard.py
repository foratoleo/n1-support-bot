"""Wizard guiado de coleta de report de erro via botões inline.

Implementa o fluxo RPT-01 a RPT-11:
  área → sintoma → quando → frequência → detalhes (opcional) → confirmação → submit

Cada etapa usa edit_message_text para evitar flooding de mensagens.
Estado do wizard é armazenado em user_state.menu_context sob a chave "rpt_wizard".
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from uuid import UUID

from telegram import Update

from src.bot.callback_router import register
from src.bot.conversation_manager import ConversationManager, ConversationState
from src.bot import strings
from src.bot.keyboards import (
    get_main_menu_keyboard,
    get_report_area_keyboard,
    get_report_symptom_keyboard,
    get_report_when_keyboard,
    get_report_frequency_keyboard,
    get_report_details_keyboard,
    get_report_confirm_keyboard,
    get_report_duplicate_keyboard,
)
from src.database.connection import get_database_pool
from src.database.repositories import UserReportRepository
from src.rag.knowledge_base import KnowledgeBaseSearcher

logger = logging.getLogger(__name__)

# Mapeamento interno de identificadores de área para rótulo legível
_AREA_LABELS: dict[str, str] = {
    "acesso": strings.BTN_AREA_ACESSO,
    "documentos": strings.BTN_AREA_DOCUMENTOS,
    "tarefas": strings.BTN_AREA_TAREFAS,
    "geral": strings.BTN_AREA_GERAL,
}

# Mapeamento interno de identificadores de sintoma para rótulo legível
_SYMPTOM_LABELS: dict[str, str] = {
    "login": strings.BTN_SYMPTOM_ACESSO_1,
    "senha": strings.BTN_SYMPTOM_ACESSO_2,
    "bloqueio": strings.BTN_SYMPTOM_ACESSO_3,
    "2fa": strings.BTN_SYMPTOM_ACESSO_4,
    "nao_gera": strings.BTN_SYMPTOM_DOCUMENTOS_1,
    "erro_doc": strings.BTN_SYMPTOM_DOCUMENTOS_2,
    "template": strings.BTN_SYMPTOM_DOCUMENTOS_3,
    "exportar": strings.BTN_SYMPTOM_DOCUMENTOS_4,
    "board": strings.BTN_SYMPTOM_TAREFAS_1,
    "criar_tarefa": strings.BTN_SYMPTOM_TAREFAS_2,
    "sprint": strings.BTN_SYMPTOM_TAREFAS_3,
    "dados": strings.BTN_SYMPTOM_TAREFAS_4,
    "pagina": strings.BTN_SYMPTOM_GERAL_1,
    "botao": strings.BTN_SYMPTOM_GERAL_2,
    "tela": strings.BTN_SYMPTOM_GERAL_3,
    "outro": strings.BTN_SYMPTOM_GERAL_4,
}

# Mapeamento de quando → rótulo
_WHEN_LABELS: dict[str, str] = {
    "hoje": strings.BTN_WHEN_TODAY,
    "ontem": strings.BTN_WHEN_YESTERDAY,
    "mais": strings.BTN_WHEN_DAYS_AGO,
    "nao_sei": strings.BTN_WHEN_UNKNOWN,
}

# Mapeamento de frequência → rótulo
_FREQ_LABELS: dict[str, str] = {
    "sempre": strings.BTN_FREQ_ALWAYS,
    "as_vezes": strings.BTN_FREQ_SOMETIMES,
    "uma_vez": strings.BTN_FREQ_ONCE,
    "intermit": strings.BTN_FREQ_INTERMITTENT,
}

# Ordenação das etapas do wizard (usada em rpt:back)
_WIZARD_STEPS = ["area", "symptom", "when", "frequency", "details", "confirm"]


def _get_conv_manager() -> ConversationManager:
    """Retorna a instância global do ConversationManager de handlers.py."""
    from src.bot.handlers import conv_manager  # noqa: PLC0415
    return conv_manager


def _get_wizard(user_state) -> Dict[str, Any]:
    """Retorna o dicionário do wizard no menu_context, criando se necessário."""
    if "rpt_wizard" not in user_state.menu_context:
        user_state.menu_context["rpt_wizard"] = {}
    return user_state.menu_context["rpt_wizard"]


def _build_confirmation_text(wizard: Dict[str, Any]) -> str:
    """Monta o texto da tela de confirmação com os dados coletados."""
    area_label = _AREA_LABELS.get(wizard.get("area", ""), wizard.get("area", "—"))
    symptom_label = _SYMPTOM_LABELS.get(wizard.get("symptom", ""), wizard.get("symptom", "—"))
    when_label = _WHEN_LABELS.get(wizard.get("when", ""), wizard.get("when", "—"))
    freq_label = _FREQ_LABELS.get(wizard.get("frequency", ""), wizard.get("frequency", "—"))
    details = wizard.get("details") or "Nenhum"

    return strings.RPT_CONFIRM_TEMPLATE.format(
        area=area_label,
        symptom=symptom_label,
        when=when_label,
        frequency=freq_label,
        details=details,
    )


def _build_description(wizard: Dict[str, Any]) -> str:
    """Monta a descrição textual do chamado a partir dos dados do wizard."""
    area_label = _AREA_LABELS.get(wizard.get("area", ""), wizard.get("area", "Geral"))
    symptom_label = _SYMPTOM_LABELS.get(wizard.get("symptom", ""), wizard.get("symptom", "Não especificado"))
    when_label = _WHEN_LABELS.get(wizard.get("when", ""), wizard.get("when", "Não informado"))
    freq_label = _FREQ_LABELS.get(wizard.get("frequency", ""), wizard.get("frequency", "Não informado"))
    details = wizard.get("details") or ""

    desc = (
        f"Área: {area_label}\n"
        f"Problema: {symptom_label}\n"
        f"Quando: {when_label}\n"
        f"Frequência: {freq_label}"
    )
    if details:
        desc += f"\nDetalhes: {details}"
    return desc


# ---------------------------------------------------------------------------
# Entry point: handler principal para prefixo "rpt:"
# ---------------------------------------------------------------------------


@register("rpt:")
async def handle_rpt_callback(update: Update, context) -> None:
    """Despachante principal do wizard de report de erro.

    Roteia sub-ações:
    - rpt:area:<id>          → seleciona área
    - rpt:symptom:<id>       → seleciona sintoma
    - rpt:when:<id>          → seleciona quando
    - rpt:freq:<id>          → seleciona frequência
    - rpt:details:skip       → pula etapa de detalhes
    - rpt:back               → retrocede uma etapa
    - rpt:confirm:submit     → confirma e cria o chamado
    - rpt:dup:yes            → aceita duplicata como resolução
    - rpt:dup:no             → ignora duplicata e cria o chamado
    """
    query = update.callback_query
    data: str = query.data or ""
    suffix = data[len("rpt:"):]  # remove prefixo "rpt:"

    if suffix.startswith("area:"):
        await _handle_area(query, update, suffix[len("area:"):])
    elif suffix.startswith("symptom:"):
        await _handle_symptom(query, update, suffix[len("symptom:"):])
    elif suffix.startswith("when:"):
        await _handle_when(query, update, suffix[len("when:"):])
    elif suffix.startswith("freq:"):
        await _handle_freq(query, update, suffix[len("freq:"):])
    elif suffix.startswith("details:"):
        await _handle_details_action(query, update, suffix[len("details:"):])
    elif suffix == "back":
        await _handle_back(query, update)
    elif suffix == "confirm:submit":
        await _handle_submit(query, update, context)
    elif suffix.startswith("dup:"):
        await _handle_duplicate_response(query, update, suffix[len("dup:"):], context)


# ---------------------------------------------------------------------------
# Ponto de entrada público — chamado por _handle_menu_erro em _callback_handlers.py
# ---------------------------------------------------------------------------


async def start_report_wizard(
    query,
    update: Update,
    from_kb_category: Optional[str] = None,
) -> None:
    """Inicia o wizard de report, opcionalmente com categoria pré-preenchida (RPT-09).

    Args:
        query: Objeto CallbackQuery do Telegram.
        update: Objeto Update do Telegram.
        from_kb_category: Identificador de área pré-preenchida (ex.: "acesso").
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    # Inicializa (ou reinicializa) o contexto do wizard
    wizard: Dict[str, Any] = {"step": "area"}
    if from_kb_category:
        wizard["from_kb_category"] = from_kb_category

    user_state.menu_context["rpt_wizard"] = wizard
    conv_manager.update_user_state(user_id, ConversationState.COLLECTING_REPORT)

    if from_kb_category:
        # RPT-09: categoria pré-preenchida — avançar direto para sintoma
        wizard["area"] = from_kb_category
        wizard["step"] = "symptom"
        area_label = _AREA_LABELS.get(from_kb_category, from_kb_category)
        await query.edit_message_text(
            text=strings.RPT_STEP_SYMPTOM.format(area=area_label),
            reply_markup=get_report_symptom_keyboard(from_kb_category),
        )
    else:
        await query.edit_message_text(
            text=strings.RPT_STEP_AREA,
            reply_markup=get_report_area_keyboard(),
        )


# ---------------------------------------------------------------------------
# Handlers de cada etapa
# ---------------------------------------------------------------------------


async def _handle_area(query, update: Update, area_id: str) -> None:
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    wizard["area"] = area_id
    wizard["step"] = "symptom"

    area_label = _AREA_LABELS.get(area_id, area_id)
    await query.edit_message_text(
        text=strings.RPT_STEP_SYMPTOM.format(area=area_label),
        reply_markup=get_report_symptom_keyboard(area_id),
    )


async def _handle_symptom(query, update: Update, symptom_id: str) -> None:
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    wizard["symptom"] = symptom_id
    wizard["step"] = "when"

    area_label = _AREA_LABELS.get(wizard.get("area", ""), "")
    await query.edit_message_text(
        text=strings.RPT_STEP_WHEN.format(area=area_label),
        reply_markup=get_report_when_keyboard(),
    )


async def _handle_when(query, update: Update, when_id: str) -> None:
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    wizard["when"] = when_id
    wizard["step"] = "frequency"

    area_label = _AREA_LABELS.get(wizard.get("area", ""), "")
    await query.edit_message_text(
        text=strings.RPT_STEP_FREQUENCY.format(area=area_label),
        reply_markup=get_report_frequency_keyboard(),
    )


async def _handle_freq(query, update: Update, freq_id: str) -> None:
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    wizard["frequency"] = freq_id
    wizard["step"] = "details"

    area_label = _AREA_LABELS.get(wizard.get("area", ""), "")
    await query.edit_message_text(
        text=strings.RPT_STEP_DETAILS.format(area=area_label),
        reply_markup=get_report_details_keyboard(),
    )


async def _handle_details_action(query, update: Update, action: str) -> None:
    """Trata a ação de pular a etapa de detalhes."""
    if action == "skip":
        user_id = update.effective_user.id
        conv_manager = _get_conv_manager()
        user_state = conv_manager.get_user_state(user_id)
        wizard = _get_wizard(user_state)

        wizard["details"] = None
        wizard["step"] = "confirm"

        await query.edit_message_text(
            text=_build_confirmation_text(wizard),
            reply_markup=get_report_confirm_keyboard(),
        )


async def _handle_back(query, update: Update) -> None:
    """Retrocede uma etapa no wizard."""
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    current_step = wizard.get("step", "area")

    try:
        current_index = _WIZARD_STEPS.index(current_step)
    except ValueError:
        current_index = 0

    if current_index <= 0:
        # Estamos na primeira etapa — volta ao menu principal
        conv_manager.update_user_state(user_id, ConversationState.IDLE)
        user_state.clear_menu()
        await query.edit_message_text(
            text=strings.MENU_WELCOME,
            reply_markup=get_main_menu_keyboard(),
        )
        return

    prev_step = _WIZARD_STEPS[current_index - 1]
    wizard["step"] = prev_step

    area_id = wizard.get("area", "geral")
    area_label = _AREA_LABELS.get(area_id, "")

    if prev_step == "area":
        await query.edit_message_text(
            text=strings.RPT_STEP_AREA,
            reply_markup=get_report_area_keyboard(),
        )
    elif prev_step == "symptom":
        await query.edit_message_text(
            text=strings.RPT_STEP_SYMPTOM.format(area=area_label),
            reply_markup=get_report_symptom_keyboard(area_id),
        )
    elif prev_step == "when":
        await query.edit_message_text(
            text=strings.RPT_STEP_WHEN.format(area=area_label),
            reply_markup=get_report_when_keyboard(),
        )
    elif prev_step == "frequency":
        await query.edit_message_text(
            text=strings.RPT_STEP_FREQUENCY.format(area=area_label),
            reply_markup=get_report_frequency_keyboard(),
        )
    elif prev_step == "details":
        await query.edit_message_text(
            text=strings.RPT_STEP_DETAILS.format(area=area_label),
            reply_markup=get_report_details_keyboard(),
        )
    elif prev_step == "confirm":
        await query.edit_message_text(
            text=_build_confirmation_text(wizard),
            reply_markup=get_report_confirm_keyboard(),
        )


async def _handle_submit(query, update: Update, context) -> None:
    """Verifica duplicatas via BM25 e, se limpo, cria o chamado no banco."""
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    description = _build_description(wizard)

    # RPT-06: detecção de duplicata via BM25
    pool = get_database_pool()
    duplicate_found = None

    try:
        kb_searcher = KnowledgeBaseSearcher(pool)
        similar = await kb_searcher.find_relevant_articles(
            issue_description=description,
            limit=1,
        )
        if similar:
            title, _content, _area = similar[0]
            duplicate_found = title
    except Exception as exc:
        logger.warning("Falha ao verificar duplicatas: %s", exc)

    if duplicate_found:
        wizard["pending_description"] = description
        wizard["step"] = "duplicate_check"
        await query.edit_message_text(
            text=strings.RPT_DUPLICATE_FOUND.format(duplicate_title=duplicate_found),
            reply_markup=get_report_duplicate_keyboard(),
        )
        return

    await _create_report(query, update, context, description, wizard)


async def _handle_duplicate_response(
    query, update: Update, action: str, context
) -> None:
    """Trata a resposta do usuário ao alerta de duplicata."""
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    wizard = _get_wizard(user_state)

    if action == "yes":
        # Usuário aceitou o artigo existente como solução
        conv_manager.update_user_state(user_id, ConversationState.IDLE)
        user_state.clear_menu()
        await query.edit_message_text(
            text=strings.CALLBACK_RESOLVED,
            reply_markup=get_main_menu_keyboard(),
        )
    else:
        # Usuário quer criar mesmo assim
        description = wizard.get("pending_description") or _build_description(wizard)
        await _create_report(query, update, context, description, wizard)


async def _create_report(
    query, update: Update, context, description: str, wizard: Dict[str, Any]
) -> None:
    """Persiste o chamado no banco e exibe confirmação ao usuário."""
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    pool = get_database_pool()

    try:
        async with pool.acquire() as session:
            repo = UserReportRepository(session)
            report = await repo.create(
                description=description,
                user_id=UUID(int=user_id) if user_id else None,
            )
        report_id = str(report.id)[:8]
    except Exception as exc:
        logger.error("Falha ao criar chamado para user_id=%s: %s", user_id, exc)
        await query.edit_message_text(
            text=strings.ERROR_GENERIC,
            reply_markup=get_main_menu_keyboard(),
        )
        return

    conv_manager.update_user_state(user_id, ConversationState.IDLE)
    user_state.clear_menu()

    await query.edit_message_text(
        text=strings.RPT_CREATED.format(report_id=report_id),
        reply_markup=get_main_menu_keyboard(),
    )

    # FBK-01: prompt de feedback automático após criação de chamado
    try:
        from src.bot.feedback_handler import send_feedback_prompt_after_edit  # noqa: PLC0415
        await send_feedback_prompt_after_edit(query, str(report.id))
    except Exception as exc:
        logger.warning("Falha ao enviar prompt de feedback após criação de chamado: %s", exc)
