"""Validation question generation for N1 Support Bot.

Generates targeted questions based on issue category to validate
user-reported issues before escalation or self-service resolution.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Question:
    """A validation question to ask the user.

    Attributes:
        id: Unique identifier for the question
        text: The question text to display to the user
        options: Optional list of choices for multiple choice questions
    """

    id: str
    text: str
    options: Optional[List[str]] = None  # For multiple choice


class QuestionGenerator:
    """Generates validation questions based on issue category.

    Questions are organized by category matching the issue types
    defined in the system specification.
    """

    # Questions by category from spec.md
    CATEGORY_QUESTIONS = {
        "data_missing": [
            Question("dm1", "Em qual projeto você está trabalhando?"),
            Question("dm2", "Você confirma que os dados deveriam existir nesse projeto?"),
            Question("dm3", "Você já tentou atualizar a página?"),
            Question("dm4", "O que você vê ao procurar pelos dados?"),
        ],
        "document_generation": [
            Question("dg1", "A partir de qual transcrição você está gerando o documento?"),
            Question("dg2", "Qual tipo de documento você selecionou?"),
            Question("dg3", "Você recebeu alguma mensagem de erro?"),
            Question("dg4", "Quanto tempo você esperou antes de o processo falhar?"),
        ],
        "task_sprint": [
            Question("ts1", "Em qual projeto e sprint está essa tarefa?"),
            Question("ts2", "Qual status a tarefa exibe atualmente?"),
            Question("ts3", "Você está atribuído como responsável pela tarefa?"),
            Question("ts4", "Você já tentou atualizar o status da tarefa?"),
        ],
        "login_auth": [
            Question("la1", "Você está vendo alguma mensagem de erro?"),
            Question("la2", "Você já tentou limpar o cache do navegador?"),
            Question("la3", "Você consegue tentar em um navegador diferente?"),
            Question("la4", "Sua senha foi alterada recentemente?"),
        ],
        "general": [
            Question("g1", "Você pode fornecer mais detalhes sobre o que aconteceu?"),
            Question("g2", "Quando esse problema começou?"),
            Question("g3", "Isso acontece sempre ou apenas às vezes?"),
        ],
    }

    def get_questions_for_category(
        self, category: str, max_questions: int = 3
    ) -> List[Question]:
        """Return 1-3 questions based on category.

        Args:
            category: The issue category (data_missing, document_generation,
                     task_sprint, login_auth, general)
            max_questions: Maximum number of questions to return (default: 3)

        Returns:
            List of Question objects to ask the user
        """
        questions = self.CATEGORY_QUESTIONS.get(
            category, self.CATEGORY_QUESTIONS["general"]
        )
        return questions[:max_questions]

    def validate_responses(
        self, questions: List[Question], answers: List[str]
    ) -> dict:
        """Validate user responses to questions.

        Analyzes the answers to determine:
        - If the issue is valid and reproducible
        - If it's a known issue
        - If it needs escalation

        Args:
            questions: List of questions that were asked
            answers: List of user answers (same order as questions)

        Returns:
            Dictionary with validation results:
            - is_valid: bool - Whether the issue appears valid
            - is_known_issue: bool - Whether this matches a known issue
            - needs_escalation: bool - Whether this needs human review
            - summary: str - Brief summary of the validation
        """
        if len(answers) != len(questions):
            return {
                "is_valid": False,
                "is_known_issue": False,
                "needs_escalation": False,
                "summary": "Number of answers does not match questions asked.",
            }

        # Check for empty or too-short answers
        empty_answers = sum(1 for a in answers if not a or len(a.strip()) < 3)
        if empty_answers > len(answers) // 2:
            return {
                "is_valid": False,
                "is_known_issue": False,
                "needs_escalation": False,
                "summary": "Insufficient information provided for validation.",
            }

        # Analyze answer patterns
        answer_text = " ".join(answers).lower()

        # Keywords suggesting user found a workaround or issue resolved
        resolved_keywords = ["fixed", "resolved", "works now", "it works", "solved"]
        has_resolved = any(kw in answer_text for kw in resolved_keywords)

        # Keywords suggesting the issue persists
        persist_keywords = [
            "still",
            "not working",
            "fails",
            "error",
            "same issue",
            "doesn't work",
        ]
        has_persist = any(kw in answer_text for kw in persist_keywords)

        # Keywords suggesting user confusion or error
        user_error_keywords = [
            "i was wrong",
            "my mistake",
            "i misunderstood",
            "wrong project",
        ]
        is_user_error = any(kw in answer_text for kw in user_error_keywords)

        if has_resolved and not has_persist:
            return {
                "is_valid": True,
                "is_known_issue": True,
                "needs_escalation": False,
                "summary": "User indicated the issue has been resolved.",
            }

        if is_user_error:
            return {
                "is_valid": False,
                "is_known_issue": False,
                "needs_escalation": False,
                "summary": "User indicated this was a misunderstanding on their part.",
            }

        if has_persist:
            return {
                "is_valid": True,
                "is_known_issue": False,
                "needs_escalation": True,
                "summary": "User confirms the issue persists after troubleshooting.",
            }

        # Default: valid issue that needs further review
        return {
            "is_valid": True,
            "is_known_issue": False,
            "needs_escalation": True,
            "summary": "Issue requires human review for resolution.",
        }
