"""Testes de validação de callback_data para o Telegram.

Verifica que todas as callback_data geradas pelo módulo keyboards.py
satisfazem o limite de 64 bytes UTF-8 do Telegram.
"""

import pytest

from src.bot.keyboards import (
    get_confirmation_keyboard,
    get_main_menu_keyboard,
    get_back_to_menu_keyboard,
    get_duvidas_submenu_keyboard,
    get_erro_submenu_keyboard,
    get_category_keyboard,
    get_report_area_keyboard,
    get_report_symptom_keyboard,
    get_report_when_keyboard,
    get_report_frequency_keyboard,
    get_report_details_keyboard,
    get_report_confirm_keyboard,
    get_report_duplicate_keyboard,
    get_kb_category_list_keyboard,
    get_kb_article_list_keyboard,
    get_kb_article_keyboard,
    get_kb_ver_mais_keyboard,
    get_kb_empty_category_keyboard,
    get_kb_search_no_results_keyboard,
    get_chamado_list_keyboard,
    get_feedback_rating_keyboard,
    get_feedback_comment_keyboard,
    get_humano_sem_chamado_keyboard,
    format_breadcrumb,
)


def _extract_callback_data(keyboard) -> list[str]:
    """Extrai todas as callback_data de um InlineKeyboardMarkup."""
    data = []
    for row in keyboard.inline_keyboard:
        for button in row:
            if button.callback_data:
                data.append(button.callback_data)
    return data


def _validate_callback_data(data: str) -> tuple[bool, int]:
    """Valida callback_data contra o limite de 64 bytes UTF-8.

    Returns:
        Tuple (is_valid, byte_size).
    """
    byte_size = len(data.encode("utf-8"))
    return byte_size <= 64, byte_size


class TestCallbackData64Bytes:
    """Testes para verificar limite de 64 bytes em callback_data."""

    def test_confirmation_keyboard(self):
        """Testa get_confirmation_keyboard."""
        keyboard = get_confirmation_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_main_menu_keyboard(self):
        """Testa get_main_menu_keyboard."""
        keyboard = get_main_menu_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_back_to_menu_keyboard(self):
        """Testa get_back_to_menu_keyboard."""
        keyboard = get_back_to_menu_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_duvidas_submenu_keyboard(self):
        """Testa get_duvidas_submenu_keyboard."""
        keyboard = get_duvidas_submenu_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_erro_submenu_keyboard(self):
        """Testa get_erro_submenu_keyboard."""
        keyboard = get_erro_submenu_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_category_keyboard(self):
        """Testa get_category_keyboard."""
        keyboard = get_category_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_report_area_keyboard(self):
        """Testa get_report_area_keyboard."""
        keyboard = get_report_area_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    @pytest.mark.parametrize("area", ["acesso", "documentos", "tarefas", "geral"])
    def test_report_symptom_keyboard(self, area):
        """Testa get_report_symptom_keyboard para cada área."""
        keyboard = get_report_symptom_keyboard(area)
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_report_when_keyboard(self):
        """Testa get_report_when_keyboard."""
        keyboard = get_report_when_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_report_frequency_keyboard(self):
        """Testa get_report_frequency_keyboard."""
        keyboard = get_report_frequency_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_report_details_keyboard(self):
        """Testa get_report_details_keyboard."""
        keyboard = get_report_details_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_report_confirm_keyboard(self):
        """Testa get_report_confirm_keyboard."""
        keyboard = get_report_confirm_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_report_duplicate_keyboard(self):
        """Testa get_report_duplicate_keyboard."""
        keyboard = get_report_duplicate_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_kb_category_list_keyboard(self):
        """Testa get_kb_category_list_keyboard."""
        keyboard = get_kb_category_list_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_kb_article_list_keyboard(self):
        """Testa get_kb_article_list_keyboard."""
        # Artigos de exemplo
        articles = [
            ("abc123def456", "Como fazer login no Workforce"),
            ("xyz789ghi012", "Recuperar senha"),
            ("mno345pqr678", "Erro de autenticação"),
        ]
        keyboard = get_kb_article_list_keyboard(articles, "acesso")
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_kb_article_keyboard(self):
        """Testa get_kb_article_keyboard."""
        article_id = "abc123def456"
        related = [
            ("rel001", "Artigo Relacionado 1"),
            ("rel002", "Artigo Relacionado 2"),
        ]
        keyboard = get_kb_article_keyboard(
            article_id, related=related, is_truncated=True
        )
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_kb_ver_mais_keyboard(self):
        """Testa get_kb_ver_mais_keyboard."""
        keyboard = get_kb_ver_mais_keyboard("abc123def456")
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_kb_empty_category_keyboard(self):
        """Testa get_kb_empty_category_keyboard."""
        keyboard = get_kb_empty_category_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_kb_search_no_results_keyboard(self):
        """Testa get_kb_search_no_results_keyboard."""
        keyboard = get_kb_search_no_results_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_chamado_list_keyboard(self):
        """Testa get_chamado_list_keyboard."""
        reports = [
            ("abc12345", "✅", "Erro de login"),
            ("def67890", "🟡", "Documento não gera"),
            ("ghi11223", "🔴", "Sprint travado"),
        ]
        keyboard = get_chamado_list_keyboard(reports)
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_feedback_rating_keyboard(self):
        """Testa get_feedback_rating_keyboard."""
        # UUID completo (36 chars + 4 hyphens = 36 chars sem hyphens, 36 com)
        report_id = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        keyboard = get_feedback_rating_keyboard(report_id)
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_feedback_comment_keyboard(self):
        """Testa get_feedback_comment_keyboard."""
        report_id = "f47ac10b"  # 8 chars (truncado)
        keyboard = get_feedback_comment_keyboard(report_id)
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"

    def test_humano_sem_chamado_keyboard(self):
        """Testa get_humano_sem_chamado_keyboard."""
        keyboard = get_humano_sem_chamado_keyboard()
        for cb in _extract_callback_data(keyboard):
            valid, size = _validate_callback_data(cb)
            assert valid, f"callback_data excede 64 bytes: {cb!r} ({size} bytes)"


class TestCallbackDataFormat:
    """Testes para verificar formato prefix:action[:param] dos callbacks."""

    def test_confirmation_format(self):
        """Confirma que callback de confirmação usa formato correto."""
        keyboard = get_confirmation_keyboard()
        callbacks = _extract_callback_data(keyboard)
        assert "yes_resolved" in callbacks
        assert "no_unresolved" in callbacks

    def test_menu_prefix_format(self):
        """Confirma que callbacks de menu usam prefixo 'menu:'."""
        keyboard = get_main_menu_keyboard()
        callbacks = _extract_callback_data(keyboard)
        for cb in callbacks:
            assert cb.startswith("menu:") or cb == "menu:duvidas" or cb == "menu:erro"

    def test_rpt_prefix_format(self):
        """Confirma que callbacks de report usam prefixo 'rpt:'."""
        keyboard = get_report_area_keyboard()
        callbacks = _extract_callback_data(keyboard)
        for cb in callbacks:
            if cb != "menu:main":
                assert cb.startswith("rpt:"), f"Callback sem prefixo rpt: {cb}"

    def test_kb_prefix_format(self):
        """Confirma que callbacks de KB usam prefixo 'kb:'."""
        keyboard = get_kb_category_list_keyboard()
        callbacks = _extract_callback_data(keyboard)
        for cb in callbacks:
            if cb not in ("nav:back", "menu:main"):
                assert cb.startswith("kb:") or cb.startswith("menu:"), (
                    f"Callback sem prefixo kb: {cb}"
                )

    def test_feedback_prefix_format(self):
        """Confirma que callbacks de feedback usam prefixo 'fbk:'."""
        report_id = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        keyboard = get_feedback_rating_keyboard(report_id)
        callbacks = _extract_callback_data(keyboard)
        for cb in callbacks:
            assert cb.startswith("fbk:"), f"Callback sem prefixo fbk: {cb}"


class TestBreadcrumb:
    """Testes para a função format_breadcrumb."""

    def test_breadcrumb_single_part(self):
        """Testa breadcrumb com uma parte."""
        result = format_breadcrumb("Tirar Dúvida")
        assert result == "Suporte Workforce > Tirar Dúvida"

    def test_breadcrumb_multiple_parts(self):
        """Testa breadcrumb com múltiplas partes."""
        result = format_breadcrumb("Tirar Dúvida", "Acesso e Login")
        assert result == "Suporte Workforce > Tirar Dúvida > Acesso e Login"

    def test_breadcrumb_root_only(self):
        """Testa breadcrumb apenas com raiz."""
        result = format_breadcrumb()
        assert result == "Suporte Workforce"
