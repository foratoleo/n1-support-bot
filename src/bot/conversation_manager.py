"""Per-user conversation state management for N1 Support Bot."""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


class ConversationState(Enum):
    """Enumeration of possible conversation states."""

    IDLE = "idle"
    AWAITING_REPORT = "awaiting_report"
    AWAITING_VALIDATION_ANSWER = "awaiting_validation_answer"
    PROVIDING_GUIDANCE = "providing_guidance"
    ESCALATED = "escalated"
    COLLECTING_REPORT = "collecting_report"
    AWAITING_KB_SEARCH = "awaiting_kb_search"


@dataclass
class UserConversationState:
    """Stores the conversation state for a specific user.

    Tracks both the report/validation workflow state (``state`` field) and the
    menu navigation position (``menu_path`` / ``menu_context`` fields).  These
    two dimensions are orthogonal: ``menu_path`` is only active when
    ``state == IDLE``; it is cleared when a workflow begins.
    """

    state: ConversationState
    user_id: int
    current_report_id: Optional[str] = None
    issue_description: Optional[str] = None
    classified_category: Optional[str] = None
    validation_questions: List[dict] = field(default_factory=list)
    current_question_index: int = 0
    validation_answers: List[str] = field(default_factory=list)
    kb_articles_found: List[tuple] = field(default_factory=list)
    escalation_id: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)

    # NAV-02 — campos de navegação por menu
    menu_path: List[str] = field(default_factory=list)
    """Pilha de posições no menu (ex.: ["main", "duvidas"])."""

    menu_context: Dict[str, Any] = field(default_factory=dict)
    """Contexto transitório associado ao nó de menu atual."""

    # ------------------------------------------------------------------
    # Helpers de navegação por menu
    # ------------------------------------------------------------------

    def push_menu(self, path: str, context: Optional[Dict[str, Any]] = None) -> None:
        """Empurra um novo nó de menu na pilha de navegação.

        Args:
            path: Identificador do nó de menu (ex.: ``"duvidas"``).
            context: Contexto arbitrário associado ao nó. Se ``None``,
                o ``menu_context`` corrente é mantido inalterado.
        """
        self.menu_path.append(path)
        if context is not None:
            self.menu_context = context

    def pop_menu(self) -> Optional[str]:
        """Remove e retorna o nó de menu mais recente da pilha.

        Quando a pilha tem apenas um elemento, esse elemento é retornado
        sem ser removido (não é possível recuar além da raiz).

        Returns:
            O nó removido, ou ``None`` se a pilha estiver vazia.
        """
        if len(self.menu_path) > 1:
            return self.menu_path.pop()
        return self.menu_path[0] if self.menu_path else None

    def current_menu(self) -> Optional[str]:
        """Retorna o nó de menu atual sem alterar a pilha.

        Returns:
            O identificador do nó mais recente, ou ``None`` se a pilha
            estiver vazia.
        """
        return self.menu_path[-1] if self.menu_path else None

    def clear_menu(self) -> None:
        """Reinicia o estado de navegação por menu para o estado vazio."""
        self.menu_path = []
        self.menu_context = {}


class ConversationManager:
    """Manages conversation states for all users."""

    def __init__(self):
        self._states: Dict[int, UserConversationState] = {}

    def get_user_state(self, user_id: int) -> UserConversationState:
        """Get current state for user, returns IDLE if no state exists.

        Args:
            user_id: The Telegram user ID.

        Returns:
            UserConversationState with IDLE state if no prior state exists.
        """
        if user_id not in self._states:
            self._states[user_id] = UserConversationState(
                state=ConversationState.IDLE,
                user_id=user_id,
            )
        return self._states[user_id]

    def update_user_state(self, user_id: int, state: ConversationState, **kwargs) -> UserConversationState:
        """Update user state and any additional context.

        Args:
            user_id: The Telegram user ID.
            state: The new conversation state.
            **kwargs: Additional fields to update in the user state.

        Returns:
            Updated UserConversationState.
        """
        current_state = self.get_user_state(user_id)
        current_state.state = state

        for key, value in kwargs.items():
            if hasattr(current_state, key):
                setattr(current_state, key, value)
            else:
                current_state.context[key] = value

        return current_state

    def clear_user_state(self, user_id: int) -> None:
        """Reset user state to IDLE.

        Limpa todos os campos do estado, incluindo os campos de navegação
        de menu (``menu_path`` e ``menu_context``).

        Args:
            user_id: The Telegram user ID.
        """
        if user_id in self._states:
            self._states[user_id].state = ConversationState.IDLE
            self._states[user_id].current_report_id = None
            self._states[user_id].issue_description = None
            self._states[user_id].classified_category = None
            self._states[user_id].validation_questions = []
            self._states[user_id].current_question_index = 0
            self._states[user_id].validation_answers = []
            self._states[user_id].kb_articles_found = []
            self._states[user_id].escalation_id = None
            self._states[user_id].context = {}
            self._states[user_id].menu_path = []
            self._states[user_id].menu_context = {}

    async def edit_message_and_update_state(
        self,
        query,
        user_id: int,
        new_state: ConversationState,
        text: str,
        reply_markup=None,
        parse_mode: Optional[str] = None,
        **state_kwargs,
    ) -> UserConversationState:
        """Edita a mensagem Telegram e atualiza o estado do usuário no mesmo bloco try/except.

        Garante que a atualização de mensagem e a mudança de estado sejam
        tratadas atomicamente: se ``edit_message_text`` lançar uma exceção,
        o estado **não** é atualizado, evitando inconsistências.

        Args:
            query: Objeto ``CallbackQuery`` do python-telegram-bot.
            user_id: ID do usuário Telegram.
            new_state: Novo ``ConversationState`` a ser definido.
            text: Texto a enviar via ``edit_message_text``.
            reply_markup: ``InlineKeyboardMarkup`` opcional a anexar à mensagem.
            parse_mode: Modo de formatação (ex.: ``"Markdown"``).
            **state_kwargs: Campos adicionais a atualizar no estado do usuário.

        Returns:
            O ``UserConversationState`` atualizado.

        Raises:
            Exception: Qualquer exceção lançada por ``edit_message_text`` é
                re-lançada após log; o estado **não** é modificado.
        """
        import logging
        logger = logging.getLogger(__name__)

        try:
            await query.edit_message_text(
                text=text,
                reply_markup=reply_markup,
                parse_mode=parse_mode,
            )
            return self.update_user_state(user_id, new_state, **state_kwargs)
        except Exception as exc:
            logger.error(
                "Falha ao editar mensagem ou atualizar estado para user_id=%s: %s",
                user_id,
                exc,
            )
            raise