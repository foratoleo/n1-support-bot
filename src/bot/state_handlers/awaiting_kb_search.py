"""Handler para o estado AWAITING_KB_SEARCH da conversa."""

from telegram import Update

from src.bot import strings
from src.bot.conversation_manager import ConversationManager, ConversationState, UserConversationState
from src.database.connection import get_database_pool
from src.database.repositories import KBDocumentRepository
from src.rag.knowledge_base import KnowledgeBaseSearcher


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado AWAITING_KB_SEARCH.

    Realiza busca BM25 com o texto digitado e exibe artigos como botões inline (KB-07).

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    user_id = update.effective_user.id
    query_text = update.message.text.strip()
    pool = get_database_pool()

    kb_searcher = KnowledgeBaseSearcher(pool)
    results = await kb_searcher.find_relevant_articles(
        issue_description=query_text,
        limit=5,
    )

    conv_manager.update_user_state(user_id, ConversationState.IDLE)

    if not results:
        from src.bot.keyboards import get_kb_search_no_results_keyboard  # noqa: PLC0415
        await update.message.reply_text(
            strings.KB_SEARCH_NO_RESULTS.format(query=query_text),
            reply_markup=get_kb_search_no_results_keyboard(),
        )
        return

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
