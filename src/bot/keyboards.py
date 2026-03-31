"""Módulo de fábrica de InlineKeyboard para o bot de suporte.

Todas as funções retornam InlineKeyboardMarkup prontos para uso nos handlers.
Nenhuma lógica de negócio aqui — apenas construção de teclados.
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from src.bot.strings import (
    BTN_YES_RESOLVED,
    BTN_NO_UNRESOLVED,
    BTN_TIRAR_DUVIDA,
    BTN_REPORTAR_ERRO,
    BTN_ACOMPANHAR_CHAMADO,
    BTN_FALAR_HUMANO,
    BTN_MENU_PRINCIPAL,
    BREADCRUMB_ROOT,
)


# ---------------------------------------------------------------------------
# Constantes de callback_data
# ---------------------------------------------------------------------------

CB_YES_RESOLVED = "yes_resolved"
CB_NO_UNRESOLVED = "no_unresolved"


# ---------------------------------------------------------------------------
# Validação de byte budget
# ---------------------------------------------------------------------------


def _assert_callback_data(data: str) -> str:
    """Valida que callback_data respeita o limite de 64 bytes UTF-8 do Telegram.

    Args:
        data: String de callback_data a ser validada.

    Returns:
        A própria string, se válida.

    Raises:
        ValueError: Se o tamanho em bytes exceder 64.
    """
    size = len(data.encode("utf-8"))
    if size > 64:
        raise ValueError(
            f"callback_data excede o limite de 64 bytes: {data!r} ({size} bytes)"
        )
    return data


# ---------------------------------------------------------------------------
# Teclados públicos
# ---------------------------------------------------------------------------


def get_confirmation_keyboard() -> InlineKeyboardMarkup:
    """Teclado de confirmação Sim/Não após orientação por base de conhecimento.

    Returns:
        InlineKeyboardMarkup com botões "Sim, resolveu" e "Não, ainda preciso de ajuda".
    """
    keyboard = [
        [
            InlineKeyboardButton(
                BTN_YES_RESOLVED,
                callback_data=_assert_callback_data(CB_YES_RESOLVED),
            ),
            InlineKeyboardButton(
                BTN_NO_UNRESOLVED,
                callback_data=_assert_callback_data(CB_NO_UNRESOLVED),
            ),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def format_breadcrumb(*path_parts: str) -> str:
    """Formata o cabeçalho de breadcrumb para mensagens de menu.

    Args:
        *path_parts: Partes do caminho de navegação. O root (BREADCRUMB_ROOT)
            é sempre prefixado automaticamente.

    Returns:
        String formatada com separador " > ", ex.: "Suporte Workforce > Tirar Dúvida".

    Exemplo::

        format_breadcrumb("Tirar Dúvida")
        # "Suporte Workforce > Tirar Dúvida"

        format_breadcrumb()
        # "Suporte Workforce"
    """
    parts = [BREADCRUMB_ROOT, *path_parts]
    return " > ".join(parts)


def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    """Teclado do menu principal com 4 opções em grade 2x2.

    Callback data no formato "menu:<ação>" para ser roteado pelo callback_router.

    Returns:
        InlineKeyboardMarkup com botões: Tirar Dúvida, Reportar Erro,
        Acompanhar Chamado e Falar com Humano.
    """
    keyboard = [
        [
            InlineKeyboardButton(
                BTN_TIRAR_DUVIDA,
                callback_data=_assert_callback_data("menu:duvidas"),
            ),
            InlineKeyboardButton(
                BTN_REPORTAR_ERRO,
                callback_data=_assert_callback_data("menu:erro"),
            ),
        ],
        [
            InlineKeyboardButton(
                BTN_ACOMPANHAR_CHAMADO,
                callback_data=_assert_callback_data("menu:chamado"),
            ),
            InlineKeyboardButton(
                BTN_FALAR_HUMANO,
                callback_data=_assert_callback_data("menu:humano"),
            ),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_back_to_menu_keyboard() -> InlineKeyboardMarkup:
    """Teclado com botão único de retorno ao menu principal.

    Usado em submenus e páginas de conteúdo para garantir que o usuário
    sempre consiga voltar ao ponto de partida (NAV-04).

    Returns:
        InlineKeyboardMarkup com botão "Menu Principal" (callback_data="menu:main").
    """
    keyboard = [
        [
            InlineKeyboardButton(
                BTN_MENU_PRINCIPAL,
                callback_data=_assert_callback_data("menu:main"),
            ),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)
