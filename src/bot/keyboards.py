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
    BTN_VOLTAR,
    BTN_CAT_ACESSO,
    BTN_CAT_DOCUMENTOS,
    BTN_CAT_TAREFAS,
    BTN_CAT_GERAL,
    # Wizard de report (Fase 6)
    BTN_PULAR,
    BTN_CONFIRMAR,
    BTN_CORRIGIR,
    BTN_AREA_ACESSO,
    BTN_AREA_DOCUMENTOS,
    BTN_AREA_TAREFAS,
    BTN_AREA_GERAL,
    BTN_SYMPTOM_ACESSO_1,
    BTN_SYMPTOM_ACESSO_2,
    BTN_SYMPTOM_ACESSO_3,
    BTN_SYMPTOM_ACESSO_4,
    BTN_SYMPTOM_DOCUMENTOS_1,
    BTN_SYMPTOM_DOCUMENTOS_2,
    BTN_SYMPTOM_DOCUMENTOS_3,
    BTN_SYMPTOM_DOCUMENTOS_4,
    BTN_SYMPTOM_TAREFAS_1,
    BTN_SYMPTOM_TAREFAS_2,
    BTN_SYMPTOM_TAREFAS_3,
    BTN_SYMPTOM_TAREFAS_4,
    BTN_SYMPTOM_GERAL_1,
    BTN_SYMPTOM_GERAL_2,
    BTN_SYMPTOM_GERAL_3,
    BTN_SYMPTOM_GERAL_4,
    BTN_WHEN_TODAY,
    BTN_WHEN_YESTERDAY,
    BTN_WHEN_DAYS_AGO,
    BTN_WHEN_UNKNOWN,
    BTN_FREQ_ALWAYS,
    BTN_FREQ_SOMETIMES,
    BTN_FREQ_ONCE,
    BTN_FREQ_INTERMITTENT,
    RPT_DUPLICATE_YES,
    RPT_DUPLICATE_NO,
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


def get_duvidas_submenu_keyboard() -> InlineKeyboardMarkup:
    """Teclado do submenu "Tirar Dúvida" com categorias da KB e botões de navegação.

    Categorias disponíveis:
    - Acesso e Login
    - Geração de Documentos
    - Tarefas e Sprints
    - Suporte Geral

    Inclui botões "Voltar" (nav:back) e "Menu Principal" (menu:main).

    Returns:
        InlineKeyboardMarkup com categorias + botões de navegação.
    """
    keyboard = [
        [
            InlineKeyboardButton(
                BTN_CAT_ACESSO,
                callback_data=_assert_callback_data("menu:duvidas:acesso"),
            ),
        ],
        [
            InlineKeyboardButton(
                BTN_CAT_DOCUMENTOS,
                callback_data=_assert_callback_data("menu:duvidas:documentos"),
            ),
        ],
        [
            InlineKeyboardButton(
                BTN_CAT_TAREFAS,
                callback_data=_assert_callback_data("menu:duvidas:tarefas"),
            ),
        ],
        [
            InlineKeyboardButton(
                BTN_CAT_GERAL,
                callback_data=_assert_callback_data("menu:duvidas:geral"),
            ),
        ],
        [
            InlineKeyboardButton(
                BTN_VOLTAR,
                callback_data=_assert_callback_data("nav:back"),
            ),
            InlineKeyboardButton(
                BTN_MENU_PRINCIPAL,
                callback_data=_assert_callback_data("menu:main"),
            ),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_erro_submenu_keyboard() -> InlineKeyboardMarkup:
    """Teclado do submenu "Reportar Erro" com botões de navegação (placeholder para Fase 6).

    Inclui botões "Voltar" (nav:back) e "Menu Principal" (menu:main).

    Returns:
        InlineKeyboardMarkup com botões de navegação.
    """
    keyboard = [
        [
            InlineKeyboardButton(
                BTN_VOLTAR,
                callback_data=_assert_callback_data("nav:back"),
            ),
            InlineKeyboardButton(
                BTN_MENU_PRINCIPAL,
                callback_data=_assert_callback_data("menu:main"),
            ),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_category_keyboard() -> InlineKeyboardMarkup:
    """Teclado para páginas de conteúdo de categoria com botões "Voltar" e "Menu Principal".

    Usado nas folhas da árvore de navegação (níveis mais profundos).

    Returns:
        InlineKeyboardMarkup com botões "Voltar" e "Menu Principal".
    """
    keyboard = [
        [
            InlineKeyboardButton(
                BTN_VOLTAR,
                callback_data=_assert_callback_data("nav:back"),
            ),
            InlineKeyboardButton(
                BTN_MENU_PRINCIPAL,
                callback_data=_assert_callback_data("menu:main"),
            ),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# ---------------------------------------------------------------------------
# Teclados do wizard de report de erro — Fase 6
# ---------------------------------------------------------------------------


def get_report_area_keyboard() -> InlineKeyboardMarkup:
    """Teclado de seleção de área do wizard de report.

    Exibe as quatro áreas disponíveis mais o botão de cancelar.

    Returns:
        InlineKeyboardMarkup com opções de área e botão Cancelar.
    """
    keyboard = [
        [InlineKeyboardButton(BTN_AREA_ACESSO, callback_data=_assert_callback_data("rpt:area:acesso"))],
        [InlineKeyboardButton(BTN_AREA_DOCUMENTOS, callback_data=_assert_callback_data("rpt:area:documentos"))],
        [InlineKeyboardButton(BTN_AREA_TAREFAS, callback_data=_assert_callback_data("rpt:area:tarefas"))],
        [InlineKeyboardButton(BTN_AREA_GERAL, callback_data=_assert_callback_data("rpt:area:geral"))],
        [
            InlineKeyboardButton(BTN_MENU_PRINCIPAL, callback_data=_assert_callback_data("menu:main")),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


_SYMPTOM_OPTIONS: dict[str, list[tuple[str, str]]] = {
    "acesso": [
        (BTN_SYMPTOM_ACESSO_1, "rpt:symptom:login"),
        (BTN_SYMPTOM_ACESSO_2, "rpt:symptom:senha"),
        (BTN_SYMPTOM_ACESSO_3, "rpt:symptom:bloqueio"),
        (BTN_SYMPTOM_ACESSO_4, "rpt:symptom:2fa"),
    ],
    "documentos": [
        (BTN_SYMPTOM_DOCUMENTOS_1, "rpt:symptom:nao_gera"),
        (BTN_SYMPTOM_DOCUMENTOS_2, "rpt:symptom:erro_doc"),
        (BTN_SYMPTOM_DOCUMENTOS_3, "rpt:symptom:template"),
        (BTN_SYMPTOM_DOCUMENTOS_4, "rpt:symptom:exportar"),
    ],
    "tarefas": [
        (BTN_SYMPTOM_TAREFAS_1, "rpt:symptom:board"),
        (BTN_SYMPTOM_TAREFAS_2, "rpt:symptom:criar_tarefa"),
        (BTN_SYMPTOM_TAREFAS_3, "rpt:symptom:sprint"),
        (BTN_SYMPTOM_TAREFAS_4, "rpt:symptom:dados"),
    ],
    "geral": [
        (BTN_SYMPTOM_GERAL_1, "rpt:symptom:pagina"),
        (BTN_SYMPTOM_GERAL_2, "rpt:symptom:botao"),
        (BTN_SYMPTOM_GERAL_3, "rpt:symptom:tela"),
        (BTN_SYMPTOM_GERAL_4, "rpt:symptom:outro"),
    ],
}


def get_report_symptom_keyboard(area: str) -> InlineKeyboardMarkup:
    """Teclado de seleção de sintoma baseado na área escolhida.

    Args:
        area: Identificador interno da área ("acesso", "documentos", "tarefas", "geral").

    Returns:
        InlineKeyboardMarkup com opções de sintoma e botão Voltar.
    """
    options = _SYMPTOM_OPTIONS.get(area, _SYMPTOM_OPTIONS["geral"])
    keyboard = [
        [InlineKeyboardButton(label, callback_data=_assert_callback_data(cb))]
        for label, cb in options
    ]
    keyboard.append([
        InlineKeyboardButton(BTN_VOLTAR, callback_data=_assert_callback_data("rpt:back")),
        InlineKeyboardButton(BTN_MENU_PRINCIPAL, callback_data=_assert_callback_data("menu:main")),
    ])
    return InlineKeyboardMarkup(keyboard)


def get_report_when_keyboard() -> InlineKeyboardMarkup:
    """Teclado de seleção de quando o problema começou.

    Returns:
        InlineKeyboardMarkup com opções de timing e botão Voltar.
    """
    keyboard = [
        [
            InlineKeyboardButton(BTN_WHEN_TODAY, callback_data=_assert_callback_data("rpt:when:hoje")),
            InlineKeyboardButton(BTN_WHEN_YESTERDAY, callback_data=_assert_callback_data("rpt:when:ontem")),
        ],
        [
            InlineKeyboardButton(BTN_WHEN_DAYS_AGO, callback_data=_assert_callback_data("rpt:when:mais")),
            InlineKeyboardButton(BTN_WHEN_UNKNOWN, callback_data=_assert_callback_data("rpt:when:nao_sei")),
        ],
        [
            InlineKeyboardButton(BTN_VOLTAR, callback_data=_assert_callback_data("rpt:back")),
            InlineKeyboardButton(BTN_MENU_PRINCIPAL, callback_data=_assert_callback_data("menu:main")),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_report_frequency_keyboard() -> InlineKeyboardMarkup:
    """Teclado de seleção de frequência do problema.

    Returns:
        InlineKeyboardMarkup com opções de frequência e botão Voltar.
    """
    keyboard = [
        [
            InlineKeyboardButton(BTN_FREQ_ALWAYS, callback_data=_assert_callback_data("rpt:freq:sempre")),
            InlineKeyboardButton(BTN_FREQ_SOMETIMES, callback_data=_assert_callback_data("rpt:freq:as_vezes")),
        ],
        [
            InlineKeyboardButton(BTN_FREQ_ONCE, callback_data=_assert_callback_data("rpt:freq:uma_vez")),
            InlineKeyboardButton(BTN_FREQ_INTERMITTENT, callback_data=_assert_callback_data("rpt:freq:intermit")),
        ],
        [
            InlineKeyboardButton(BTN_VOLTAR, callback_data=_assert_callback_data("rpt:back")),
            InlineKeyboardButton(BTN_MENU_PRINCIPAL, callback_data=_assert_callback_data("menu:main")),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_report_details_keyboard() -> InlineKeyboardMarkup:
    """Teclado da etapa de detalhes opcionais.

    Exibe apenas o botão Pular (texto ou foto são aceitos como mensagem).

    Returns:
        InlineKeyboardMarkup com botão Pular e botão Voltar.
    """
    keyboard = [
        [InlineKeyboardButton(BTN_PULAR, callback_data=_assert_callback_data("rpt:details:skip"))],
        [
            InlineKeyboardButton(BTN_VOLTAR, callback_data=_assert_callback_data("rpt:back")),
            InlineKeyboardButton(BTN_MENU_PRINCIPAL, callback_data=_assert_callback_data("menu:main")),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_report_confirm_keyboard() -> InlineKeyboardMarkup:
    """Teclado da tela de confirmação do report.

    Returns:
        InlineKeyboardMarkup com botões Confirmar Envio, Corrigir Dados e Menu Principal.
    """
    keyboard = [
        [InlineKeyboardButton(BTN_CONFIRMAR, callback_data=_assert_callback_data("rpt:confirm:submit"))],
        [InlineKeyboardButton(BTN_CORRIGIR, callback_data=_assert_callback_data("rpt:back"))],
        [InlineKeyboardButton(BTN_MENU_PRINCIPAL, callback_data=_assert_callback_data("menu:main"))],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_report_duplicate_keyboard() -> InlineKeyboardMarkup:
    """Teclado de alerta de chamado duplicado.

    Returns:
        InlineKeyboardMarkup com opções de confirmar duplicata ou criar mesmo assim.
    """
    keyboard = [
        [InlineKeyboardButton(RPT_DUPLICATE_YES, callback_data=_assert_callback_data("rpt:dup:yes"))],
        [InlineKeyboardButton(RPT_DUPLICATE_NO, callback_data=_assert_callback_data("rpt:dup:no"))],
    ]
    return InlineKeyboardMarkup(keyboard)
