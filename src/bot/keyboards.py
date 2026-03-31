"""Módulo de fábrica de InlineKeyboard para o bot de suporte.

Todas as funções retornam InlineKeyboardMarkup prontos para uso nos handlers.
Nenhuma lógica de negócio aqui — apenas construção de teclados.
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from src.bot.strings import BTN_YES_RESOLVED, BTN_NO_UNRESOLVED


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


def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    """Teclado do menu principal (placeholder para a Fase 4).

    Será expandido na Fase 4 com as opções de navegação completas:
    Tirar Dúvidas, Reportar Erro, Acompanhar Chamado, Falar com Humano.

    Returns:
        InlineKeyboardMarkup com opções do menu principal.
    """
    # Placeholder: apenas uma linha indicando que o menu principal será implementado na Fase 4.
    # Na Fase 4, este teclado receberá os botões reais com callback_data "menu:*".
    keyboard: list[list[InlineKeyboardButton]] = []
    return InlineKeyboardMarkup(keyboard)
