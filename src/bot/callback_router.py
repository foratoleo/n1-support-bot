"""Router de callbacks por prefixo para o bot de suporte.

Substitui a cadeia if/elif em button_callback (handlers.py) por um sistema de
despacho baseado em prefixo, permitindo que novos handlers sejam registrados
sem modificar este módulo.

Uso:
    @register("yes_resolved")
    async def handle_yes(update, context):
        ...

    # Em register_handlers():
    application.add_handler(CallbackQueryHandler(route_callback))
"""

import logging
from collections.abc import Callable, Coroutine
from typing import Any

from telegram import Update
from telegram.error import BadRequest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Registro de handlers
# ---------------------------------------------------------------------------

# Mapeamento prefixo → função handler.
# A chave pode ser um prefixo (e.g. "menu:") ou um valor exato (e.g. "yes_resolved").
_HANDLERS: dict[str, Callable[..., Coroutine[Any, Any, None]]] = {}


def register(
    prefix: str,
) -> Callable[
    [Callable[..., Coroutine[Any, Any, None]]],
    Callable[..., Coroutine[Any, Any, None]],
]:
    """Decorador que registra uma função como handler para um prefixo de callback_data.

    Handlers registrados com prefixo mais longo têm prioridade sobre os mais curtos,
    pois o router percorre os prefixos em ordem decrescente de comprimento.

    Args:
        prefix: Prefixo (ou valor exato) do callback_data que este handler atende.

    Returns:
        Decorador que registra a função no registry e a retorna sem modificações.

    Exemplo::

        @register("menu:")
        async def handle_menu(update: Update, context) -> None:
            ...
    """

    def decorator(
        fn: Callable[..., Coroutine[Any, Any, None]],
    ) -> Callable[..., Coroutine[Any, Any, None]]:
        _HANDLERS[prefix] = fn
        return fn

    return decorator


# ---------------------------------------------------------------------------
# Entry point principal
# ---------------------------------------------------------------------------


async def route_callback(update: Update, context: Any) -> None:
    """Despachante central de CallbackQuery.

    Deve ser registrado como único CallbackQueryHandler na aplicação:

        application.add_handler(CallbackQueryHandler(route_callback))

    Comportamento:
    1. Chama ``await query.answer()`` como primeira ação (NAV-07).
    2. Extrai ``callback_data`` do query.
    3. Percorre os prefixos registrados (mais longos primeiro) até encontrar match.
    4. Despacha para o handler correspondente.
    5. Se nenhum handler atender, loga um aviso e ignora silenciosamente.

    Args:
        update: O objeto de atualização do Telegram.
        context: O contexto de callback do PTB.
    """
    query = update.callback_query
    # NAV-07: query.answer() DEVE ser chamado como primeira linha em todo handler de CallbackQuery.
    await query.answer()

    data: str = query.data or ""

    # Ordena por comprimento decrescente para garantir que prefixos mais específicos
    # têm prioridade (ex.: "yes_resolved" tem prioridade sobre "yes").
    for prefix in sorted(_HANDLERS, key=len, reverse=True):
        if data.startswith(prefix) or data == prefix:
            try:
                await _HANDLERS[prefix](update, context)
            except BadRequest as exc:
                if "Message is not modified" in str(exc):
                    logger.debug("edit_message_text ignorado — conteúdo idêntico: %s", data)
                else:
                    raise
            return

    logger.warning("Nenhum handler para callback_data: %s", data)


# ---------------------------------------------------------------------------
# Importação dos handlers existentes para forçar o registro via @register
# ---------------------------------------------------------------------------
# Este import DEVE ficar ao final do módulo para evitar importação circular.
# Os handlers usam @register() ao ser importados, populando _HANDLERS.
import src.bot._callback_handlers  # noqa: E402, F401
import src.bot.report_wizard  # noqa: E402, F401
import src.bot.kb_browser  # noqa: E402, F401
import src.bot.feedback_handler  # noqa: E402, F401
