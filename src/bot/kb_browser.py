"""Handlers de navegação pela Knowledge Base via botões inline.

Implementa os requisitos KB-01 a KB-08:
- KB-01: listagem de categorias via InlineKeyboard
- KB-02: listagem de artigos dentro de categoria, ordenados por acessos
- KB-03: exibição de artigo com resumo (300 chars) + botão Ver mais
- KB-04: prompt "Isso resolveu?" com Sim/Não
- KB-05: "Não" redireciona para wizard de report com categoria pré-preenchida
- KB-06: artigos ordenados por acessos decrescentes
- KB-07: até 3 artigos relacionados sugeridos após artigo
- KB-08: thumbs-up/down por artigo

Prefixo de callback: "kb:"
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from telegram import Update

from src.bot.callback_router import register
from src.bot.conversation_manager import ConversationManager, ConversationState
from src.bot import strings
from src.bot.keyboards import (
    get_kb_category_list_keyboard,
    get_kb_article_list_keyboard,
    get_kb_article_keyboard,
    get_main_menu_keyboard,
    get_back_to_menu_keyboard,
    format_breadcrumb,
)
from src.database.connection import get_database_pool

logger = logging.getLogger(__name__)

# Mapeamento de identificador de categoria para rótulo legível
_CATEGORY_LABELS: dict[str, str] = {
    "acesso": strings.BTN_CAT_ACESSO,
    "documentos": strings.BTN_CAT_DOCUMENTOS,
    "tarefas": strings.BTN_CAT_TAREFAS,
    "geral": strings.BTN_CAT_GERAL,
}

# Mapeamento de identificador de categoria para área na KB (campo `area` no DB)
_CATEGORY_AREA_MAP: dict[str, str] = {
    "acesso": "login_auth",
    "documentos": "document_generation",
    "tarefas": "task_sprint",
    "geral": "general",
}

# Armazenamento em memória de contagem de acessos por artigo (article_id → count)
# Em produção isso seria persistido no banco; aqui usamos dict simples por sessão.
_access_counts: dict[str, int] = {}

# Armazenamento em memória de ratings por artigo (article_id → {"up": int, "dn": int})
_article_ratings: dict[str, dict[str, int]] = {}


def _get_conv_manager() -> ConversationManager:
    """Retorna a instância global do ConversationManager de handlers.py."""
    from src.bot.handlers import conv_manager  # noqa: PLC0415
    return conv_manager


def _increment_access(article_id: str) -> int:
    """Incrementa o contador de acessos de um artigo e retorna o novo valor."""
    _access_counts[article_id] = _access_counts.get(article_id, 0) + 1
    return _access_counts[article_id]


def _truncate_content(content: str, max_chars: int = 300) -> tuple[str, bool]:
    """Trunca o conteúdo a max_chars caracteres.

    Args:
        content: Texto completo do artigo.
        max_chars: Limite de caracteres para o resumo.

    Returns:
        Tupla (texto_truncado, foi_truncado).
    """
    if len(content) <= max_chars:
        return content, False
    return content[:max_chars].rstrip() + "…", True


async def _get_article_by_id(article_id: str) -> Optional[object]:
    """Busca um artigo da KB pelo ID (UUID string).

    Args:
        article_id: UUID do artigo como string.

    Returns:
        Objeto KBDocument ou None se não encontrado.
    """
    try:
        doc_uuid = UUID(article_id)
    except ValueError:
        return None

    pool = get_database_pool()
    from src.database.repositories import KBDocumentRepository  # noqa: PLC0415

    async with pool.acquire() as session:
        repo = KBDocumentRepository(session)
        return await repo.get_by_id(doc_uuid)


async def _get_articles_by_category(category: str) -> list[tuple[str, str, str]]:
    """Retorna artigos de uma categoria, ordenados por acessos decrescentes.

    Args:
        category: Identificador de categoria ("acesso", "documentos", "tarefas", "geral").

    Returns:
        Lista de tuplas (article_id, title, area).
    """
    area = _CATEGORY_AREA_MAP.get(category, "general")
    pool = get_database_pool()
    from src.database.repositories import KBDocumentRepository  # noqa: PLC0415

    async with pool.acquire() as session:
        repo = KBDocumentRepository(session)
        docs = await repo.get_by_area(area)

    # Ordenar por acessos decrescentes (KB-06)
    result = [(str(doc.id), doc.title, doc.area) for doc in docs]
    result.sort(key=lambda x: _access_counts.get(x[0], 0), reverse=True)
    return result


async def _get_related_articles(article_id: str, area: str, limit: int = 3) -> list[tuple[str, str]]:
    """Retorna artigos relacionados (mesma área, excluindo o atual).

    Args:
        article_id: ID do artigo atual (excluído dos resultados).
        area: Área do artigo atual para busca de relacionados.
        limit: Número máximo de artigos relacionados.

    Returns:
        Lista de tuplas (related_id, title).
    """
    pool = get_database_pool()
    from src.database.repositories import KBDocumentRepository  # noqa: PLC0415

    async with pool.acquire() as session:
        repo = KBDocumentRepository(session)
        docs = await repo.get_by_area(area)

    related = [
        (str(doc.id), doc.title)
        for doc in docs
        if str(doc.id) != article_id
    ]
    # Ordena por acessos para priorizar artigos mais populares
    related.sort(key=lambda x: _access_counts.get(x[0], 0), reverse=True)
    return related[:limit]


# ---------------------------------------------------------------------------
# Handler principal — prefixo "kb:"
# ---------------------------------------------------------------------------


@register("kb:")
async def handle_kb_callback(update: Update, context) -> None:
    """Despachante de callbacks com prefixo 'kb:' — navegação pela KB.

    Ações suportadas:
    - kb:cat:{category}            → lista artigos da categoria
    - kb:art:{article_id}          → exibe resumo do artigo
    - kb:full:{article_id}         → exibe artigo completo (Ver mais)
    - kb:resolved:{article_id}     → marca como resolvido
    - kb:unresolved:{article_id}   → redireciona para report com categoria
    - kb:rate:{article_id}:up|dn   → registra avaliação do artigo
    - kb:search                    → ativa estado de busca por keyword

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    data: str = query.data or ""
    suffix = data[len("kb:"):]  # remove prefixo "kb:"

    if suffix.startswith("cat:"):
        category = suffix[len("cat:"):]
        await _handle_kb_category(query, update, category)

    elif suffix.startswith("art:"):
        article_id = suffix[len("art:"):]
        await _handle_kb_article(query, update, article_id)

    elif suffix.startswith("full:"):
        article_id = suffix[len("full:"):]
        await _handle_kb_full_article(query, update, article_id)

    elif suffix.startswith("resolved:"):
        article_id = suffix[len("resolved:"):]
        await _handle_kb_resolved(query, update, article_id)

    elif suffix.startswith("unresolved:"):
        article_id = suffix[len("unresolved:"):]
        await _handle_kb_unresolved(query, update, article_id, context)

    elif suffix.startswith("rate:"):
        # formato: rate:{article_id}:up|dn
        parts = suffix[len("rate:"):].rsplit(":", 1)
        if len(parts) == 2:
            article_id, direction = parts
            await _handle_kb_rate(query, update, article_id, direction)

    elif suffix == "search":
        await _handle_kb_search_prompt(query, update)


# ---------------------------------------------------------------------------
# Sub-handlers
# ---------------------------------------------------------------------------


async def _handle_kb_category(query, update: Update, category: str) -> None:
    """Exibe lista de artigos de uma categoria, ordenados por acessos (KB-01, KB-06).

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        category: Identificador da categoria.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    user_state.push_menu(f"kb:cat:{category}")

    category_label = _CATEGORY_LABELS.get(category, category)
    articles = await _get_articles_by_category(category)

    if not articles:
        await query.edit_message_text(
            text=strings.KB_NO_ARTICLES,
            reply_markup=get_kb_category_list_keyboard(),
        )
        return

    # Armazena categoria no contexto para uso posterior (ex.: unresolved)
    user_state.menu_context["kb_category"] = category

    article_buttons = [(art_id, title) for art_id, title, _area in articles]
    text = strings.KB_CATEGORY_HEADER.format(category=category_label)

    await query.edit_message_text(
        text=text,
        reply_markup=get_kb_article_list_keyboard(article_buttons, category),
    )


async def _handle_kb_article(query, update: Update, article_id: str) -> None:
    """Exibe resumo do artigo (máx 300 chars) com botões de ação (KB-02, KB-03).

    Incrementa o contador de acessos do artigo.

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        article_id: UUID do artigo como string.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    doc = await _get_article_by_id(article_id)
    if not doc:
        await query.edit_message_text(
            text="Artigo não encontrado.",
            reply_markup=get_back_to_menu_keyboard(),
        )
        return

    # Incrementa acessos (KB-06)
    _increment_access(article_id)

    # Armazena contexto do artigo atual
    user_state.menu_context["kb_article_id"] = article_id
    user_state.menu_context["kb_article_area"] = doc.area

    # Trunca conteúdo a 300 chars (KB-03)
    excerpt, is_truncated = _truncate_content(doc.content, max_chars=300)
    text = strings.KB_ARTICLE_SUMMARY.format(title=doc.title, excerpt=excerpt)

    # Artigos relacionados (KB-07)
    related = await _get_related_articles(article_id, doc.area, limit=3)

    # Se há relacionados, adiciona cabeçalho "Veja também:"
    if related:
        text = f"{text}\n\n{strings.KB_VEJA_TAMBEM}"

    await query.edit_message_text(
        text=text,
        reply_markup=get_kb_article_keyboard(
            article_id=article_id,
            related=related if related else None,
            is_truncated=is_truncated,
        ),
    )


async def _handle_kb_full_article(query, update: Update, article_id: str) -> None:
    """Exibe o artigo completo após "Ver mais" (KB-03).

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        article_id: UUID do artigo como string.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    doc = await _get_article_by_id(article_id)
    if not doc:
        await query.edit_message_text(
            text="Artigo não encontrado.",
            reply_markup=get_back_to_menu_keyboard(),
        )
        return

    # Identifica categoria para o breadcrumb
    reverse_area = {v: k for k, v in _CATEGORY_AREA_MAP.items()}
    category_key = reverse_area.get(doc.area, "geral")
    category_label = _CATEGORY_LABELS.get(category_key, doc.area)

    header = strings.KB_FULL_ARTICLE_HEADER.format(
        category=category_label, title=doc.title
    )
    text = f"{header}\n\n{doc.content}"

    # Telegram limita mensagens a 4096 chars; trunca se necessário
    if len(text) > 4000:
        text = text[:4000] + "…"

    # Artigos relacionados (KB-07)
    related = await _get_related_articles(article_id, doc.area, limit=3)

    if related:
        text = f"{text}\n\n{strings.KB_VEJA_TAMBEM}"

    await query.edit_message_text(
        text=text,
        reply_markup=get_kb_article_keyboard(
            article_id=article_id,
            related=related if related else None,
            is_truncated=False,
        ),
    )


async def _handle_kb_resolved(query, update: Update, article_id: str) -> None:
    """Trata confirmação "Isso resolveu?" → Sim (KB-04).

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        article_id: UUID do artigo que resolveu a dúvida.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)
    conv_manager.update_user_state(user_id, ConversationState.IDLE)

    from src.bot.keyboards import get_main_menu_keyboard  # noqa: PLC0415
    await query.edit_message_text(
        text=strings.CALLBACK_RESOLVED,
        reply_markup=get_main_menu_keyboard(),
    )

    # FBK-01: prompt de feedback automático após KB resolver a dúvida
    report_id = user_state.current_report_id
    if report_id:
        try:
            from src.bot.feedback_handler import send_feedback_prompt_after_edit  # noqa: PLC0415
            await send_feedback_prompt_after_edit(query, report_id)
        except Exception as exc:
            logger.warning("Falha ao enviar prompt de feedback após KB resolvida: %s", exc)


async def _handle_kb_unresolved(
    query, update: Update, article_id: str, context
) -> None:
    """Trata confirmação "Isso resolveu?" → Não (KB-04, KB-05).

    Redireciona para o wizard de report com categoria pré-preenchida.

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        article_id: UUID do artigo que não resolveu.
        context: Contexto de callback do PTB.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    user_state = conv_manager.get_user_state(user_id)

    # Recupera categoria do contexto (armazenada em _handle_kb_article)
    kb_category = user_state.menu_context.get("kb_category", "geral")

    # Pré-preenche a área no wizard de report
    wizard_data = {
        "step": "symptom",
        "area": kb_category,
        "from_kb": True,
        "kb_article_id": article_id,
    }
    user_state.menu_context["rpt_wizard"] = wizard_data
    conv_manager.update_user_state(user_id, ConversationState.COLLECTING_REPORT)

    from src.bot.keyboards import get_report_symptom_keyboard  # noqa: PLC0415
    area_label = _CATEGORY_LABELS.get(kb_category, kb_category)
    text = strings.RPT_STEP_SYMPTOM.format(area=area_label)

    await query.edit_message_text(
        text=text,
        reply_markup=get_report_symptom_keyboard(kb_category),
    )


async def _handle_kb_rate(
    query, update: Update, article_id: str, direction: str
) -> None:
    """Registra avaliação thumbs-up ou thumbs-down de um artigo (KB-08).

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
        article_id: UUID do artigo avaliado.
        direction: "up" para positivo, "dn" para negativo.
    """
    if article_id not in _article_ratings:
        _article_ratings[article_id] = {"up": 0, "dn": 0}

    if direction in ("up", "dn"):
        _article_ratings[article_id][direction] += 1
        logger.info(
            "Avaliação de artigo %s: %s (up=%d, dn=%d)",
            article_id,
            direction,
            _article_ratings[article_id]["up"],
            _article_ratings[article_id]["dn"],
        )

    await query.edit_message_text(
        text=strings.KB_RATING_THANKS,
        reply_markup=get_back_to_menu_keyboard(),
    )


async def _handle_kb_search_prompt(query, update: Update) -> None:
    """Ativa estado de busca KB e exibe prompt para o usuário digitar (KB-07 fallback).

    Args:
        query: CallbackQuery do Telegram.
        update: Update do Telegram.
    """
    user_id = update.effective_user.id
    conv_manager = _get_conv_manager()
    conv_manager.update_user_state(user_id, ConversationState.AWAITING_KB_SEARCH)

    from src.bot.keyboards import get_back_to_menu_keyboard  # noqa: PLC0415
    await query.edit_message_text(
        text=strings.KB_SEARCH_PROMPT,
        reply_markup=get_back_to_menu_keyboard(),
    )
