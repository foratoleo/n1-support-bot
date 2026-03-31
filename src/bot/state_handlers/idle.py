"""Handler para o estado IDLE da conversa."""

from telegram import Update

from src.bot import strings
from src.bot.keyboards import get_main_menu_keyboard
from src.bot.conversation_manager import ConversationManager, UserConversationState


async def handle(
    update: Update,
    context,
    user_state: UserConversationState,
    conv_manager: ConversationManager,
) -> None:
    """Trata mensagens recebidas quando o usuário está no estado IDLE.

    Se ``menu_path`` estiver preenchido, re-apresenta o menu correspondente
    ao nó atual. Caso contrário, exibe o menu principal com mensagem de
    redirecionamento (NAV-06).

    Args:
        update: Objeto de atualização do Telegram.
        context: Contexto de callback do PTB.
        user_state: Estado de conversa atual do usuário.
        conv_manager: Instância global do ConversationManager.
    """
    current_menu = user_state.current_menu()

    if current_menu:
        await _send_menu_for_path(update, current_menu)
        return

    # NAV-06: texto livre fora de fluxo ativo exibe o menu principal
    await update.message.reply_text(
        strings.FREE_TEXT_REDIRECT,
        reply_markup=get_main_menu_keyboard(),
    )


async def _send_menu_for_path(update: Update, menu_node: str) -> None:
    """Reenvia o menu correspondente ao nó atual de navegação.

    Args:
        update: Objeto de atualização do Telegram.
        menu_node: Identificador do nó de menu atual (ex.: ``"duvidas"``).
    """
    from src.bot.keyboards import (  # noqa: PLC0415
        get_kb_category_list_keyboard,
        get_category_keyboard,
        get_erro_submenu_keyboard,
        get_back_to_menu_keyboard,
    )

    if menu_node == "duvidas":
        await update.message.reply_text(
            strings.MENU_DUVIDAS_INTRO,
            reply_markup=get_kb_category_list_keyboard(),
        )
    elif menu_node.startswith("duvidas:"):
        await update.message.reply_text(
            strings.MENU_DUVIDAS_INTRO,
            reply_markup=get_category_keyboard(),
        )
    elif menu_node == "erro":
        await update.message.reply_text(
            strings.MENU_ERRO_INTRO,
            reply_markup=get_erro_submenu_keyboard(),
        )
    else:
        # Fallback: menu principal
        await update.message.reply_text(
            strings.FREE_TEXT_REDIRECT,
            reply_markup=get_main_menu_keyboard(),
        )
