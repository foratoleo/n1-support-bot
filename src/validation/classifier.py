"""Issue classification for N1 Support Bot.

Classifies user-reported issues into categories and determines
whether they should be escalated to human agents.
"""

from dataclasses import dataclass
from typing import Optional, List
import json

from .questions import QuestionGenerator, Question


@dataclass
class IssueClassification:
    """Classification result for a user-reported issue.

    Attributes:
        category: Issue category (data_missing, document_generation,
                 task_sprint, login_auth, general)
        confidence: Classification confidence from 0.0 to 1.0
        summary: Brief description of the classified issue
        area: Knowledge base area (foundation, document-generation,
              frontend, planning, support)
    """

    category: str  # data_missing, document_generation, task_sprint, login_auth, general
    confidence: float  # 0.0 to 1.0
    summary: str
    area: str  # knowledge base area: foundation, document-generation, frontend, planning, support


@dataclass
class EscalationDecision:
    """Decision on whether to escalate an issue to human agents.

    Attributes:
        should_escalate: Whether the issue should be escalated
        reason: Human-readable explanation for the decision
        escalation_type: Optional type for tracking (cannot_reproduce,
                        data_corruption, auth_failure, etc.)
    """

    should_escalate: bool
    reason: str
    escalation_type: Optional[str] = None  # cannot_reproduce, data_corruption, auth_failure, etc.


class IssueClassifier:
    """Classifies issues and determines escalation needs.

    Uses a two-tier approach:
    1. Keyword-based classification as a simple fallback
    2. GPT-4o classification if OpenAI client is available

    Escalation follows criteria from spec.md section 13.
    """

    # Keywords mapping to categories and KB areas
    CATEGORY_KEYWORDS = {
        "data_missing": {
            "keywords": [
                "missing",
                "disappeared",
                "gone",
                "not found",
                "where is",
                "can't find",
                "vanished",
                "lost data",
                "no data",
            ],
            "area": "frontend",
        },
        "document_generation": {
            "keywords": [
                "generate",
                "generation",
                "document",
                "prd",
                "user story",
                "meeting notes",
                "test case",
                "technical spec",
                "transcript",
                "creating document",
            ],
            "area": "document-generation",
        },
        "task_sprint": {
            "keywords": [
                "task",
                "sprint",
                "status",
                "todo",
                "in progress",
                "done",
                "blocked",
                "assigned",
                "developer",
            ],
            "area": "planning",
        },
        "login_auth": {
            "keywords": [
                "login",
                "log in",
                "auth",
                "password",
                "session",
                "access denied",
                "unauthorized",
                "sign in",
                "logout",
                "logged out",
            ],
            "area": "foundation",
        },
    }

    ESCALATE_CRITERIA = [
        "cannot reproduce",
        "data corruption",
        "auth failure",
        "generation failure",
        "permission issue",
        "repeated issue",
        "user requests human",
    ]

    NOT_ESCALATE = [
        "user error",
        "feature request",
        "how to use",
        "known limitation",
        "rate limiting",
    ]

    def __init__(
        self,
        openai_client,
        kb_searcher,
        question_generator: QuestionGenerator,
    ):
        """Initialize the classifier.

        Args:
            openai_client: OpenAI client instance (optional, for GPT-4o classification)
            kb_searcher: Knowledge base searcher instance
            question_generator: QuestionGenerator instance for validation
        """
        self.openai_client = openai_client
        self.kb_searcher = kb_searcher
        self.question_generator = question_generator

    async def classify(
        self, issue_description: str, context: Optional[dict] = None
    ) -> IssueClassification:
        """Classify issue using keyword matching or GPT-4o.

        Args:
            issue_description: The user's reported issue text
            context: Optional context dict with project_id, user_id, etc.

        Returns:
            IssueClassification with category, confidence, summary, and area
        """
        issue_lower = issue_description.lower()

        # Try GPT-4o classification if client is available
        if self.openai_client is not None:
            try:
                return await self._classify_with_openai(issue_description, context)
            except Exception:
                # Fall back to keyword classification on error
                pass

        # Simple keyword-based classification fallback
        return self._classify_with_keywords(issue_lower)

    def _classify_with_keywords(self, issue_text: str) -> IssueClassification:
        """Classify issue using keyword matching.

        Args:
            issue_text: Lowercase issue description

        Returns:
            IssueClassification based on keyword matching
        """
        category_scores = {}

        for category, config in self.CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in config["keywords"] if kw in issue_text)
            if score > 0:
                category_scores[category] = {
                    "score": score,
                    "area": config["area"],
                }

        if not category_scores:
            return IssueClassification(
                category="general",
                confidence=0.5,
                summary="Issue does not match specific categories",
                area="support",
            )

        # Select category with highest score
        best_category = max(
            category_scores.items(), key=lambda x: x[1]["score"]
        )

        return IssueClassification(
            category=best_category[0],
            confidence=0.7,
            summary=f"Issue classified as {best_category[0]} based on keywords",
            area=best_category[1]["area"],
        )

    async def _classify_with_openai(
        self, issue_description: str, context: Optional[dict] = None
    ) -> IssueClassification:
        """Classify issue using GPT-4o for better accuracy.

        Args:
            issue_description: The user's reported issue text
            context: Optional context dict

        Returns:
            IssueClassification from GPT-4o analysis
        """
        system_prompt = """Você é um classificador de chamados de suporte para um sistema de gestão de workforce.
Classifique o problema em uma destas categorias:
- data_missing: Usuário não consegue encontrar ou acessar dados que deveriam existir
- document_generation: Problemas com geração de documentos por IA (PRD, user stories, etc.)
- task_sprint: Problemas com tarefas, sprints ou planejamento de projetos
- login_auth: Problemas de login, autenticação ou sessão
- general: Problemas que não se encaixam nas outras categorias

Também identifique a área da base de conhecimento:
- foundation: Funcionalidades centrais do sistema
- document-generation: Criação de documentos e templates
- frontend: Interface do usuário e problemas de exibição
- planning: Gestão de tarefas e sprints
- support: Tópicos gerais de suporte

Responda com um objeto JSON:
{
    "category": "nome_da_categoria",
    "confidence": 0.0-1.0,
    "summary": "descrição breve",
    "area": "area_kb"
}"""

        response = await self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": issue_description},
            ],
            response_format={"type": "json_object"},
        )

        result = response.choices[0].message.content
        import json

        parsed = json.loads(result)

        return IssueClassification(
            category=parsed.get("category", "general"),
            confidence=parsed.get("confidence", 0.5),
            summary=parsed.get("summary", ""),
            area=parsed.get("area", "support"),
        )

    async def should_escalate(
        self,
        issue_description: str,
        validation_answers: List[str],
        kb_articles: List[tuple],
    ) -> EscalationDecision:
        """Determine if issue should be escalated based on criteria.

        Evaluates:
        - Validation answers from QuestionGenerator
        - KB article matches (may indicate known issue)
        - Issue characteristics

        Args:
            issue_description: Original issue description
            validation_answers: User's answers to validation questions
            kb_articles: List of (title, content) tuples from KB search

        Returns:
            EscalationDecision with should_escalate, reason, and escalation_type
        """
        issue_lower = issue_description.lower()

        # Check for explicit user request for human help
        human_request_keywords = [
            "human",
            "agent",
            "real person",
            "speak to someone",
            "talk to support",
        ]
        if any(kw in issue_lower for kw in human_request_keywords):
            return EscalationDecision(
                should_escalate=True,
                reason="User explicitly requested human assistance",
                escalation_type="user_requests_human",
            )

        # Check for feature requests (do not escalate)
        for keyword in self.NOT_ESCALATE:
            if keyword in issue_lower:
                return EscalationDecision(
                    should_escalate=False,
                    reason=f"Issue is a {keyword}, not a bug",
                    escalation_type=None,
                )

        # Analyze KB articles for known issues
        if kb_articles:
            kb_text = " ".join([f"{title} {content}" for title, content in kb_articles]).lower()

            # If KB has articles and answers suggest issue persists, escalate
            if any(
                ans.lower() in kb_text
                for ans in validation_answers
                if len(ans) > 3
            ):
                # Check if there's a solution in KB
                solution_keywords = ["solution", "fix", "resolve", "steps", "how to"]
                has_solution = any(kw in kb_text for kw in solution_keywords)

                if not has_solution:
                    return EscalationDecision(
                        should_escalate=True,
                        reason="No solution found in knowledge base",
                        escalation_type="cannot_reproduce",
                    )

        # Analyze validation answers for escalation triggers
        answer_text = " ".join(validation_answers).lower()

        escalation_triggers = {
            "cannot_reproduce": ["cannot reproduce", "can't reproduce", "not reproducible", "doesn't happen"],
            "data_corruption": ["corrupted", "lost", "missing data", "data disappeared", "inconsistent"],
            "auth_failure": ["still can't login", "password not working", "auth error", "access denied"],
            "generation_failure": ["generation failed", "document not created", "timeout", "no response"],
            "permission issue": ["permission denied", "access denied", "not authorized", "forbidden"],
            "repeated issue": ["happens again", "repeated", "again", "same issue", "keep happening"],
        }

        for escalation_type, triggers in escalation_triggers.items():
            if any(trigger in answer_text for trigger in triggers):
                return EscalationDecision(
                    should_escalate=True,
                    reason=f"Validation indicates {escalation_type.replace('_', ' ')}",
                    escalation_type=escalation_type,
                )

        # If we have validation answers and they indicate persistence, escalate
        persist_indicators = ["still", "not working", "fails", "error", "same"]
        if any(ind in answer_text for ind in persist_indicators):
            return EscalationDecision(
                should_escalate=True,
                reason="User confirms issue persists after troubleshooting",
                escalation_type="cannot_reproduce",
            )

        # Default: do not escalate
        return EscalationDecision(
            should_escalate=False,
            reason="Issue appears resolvable through self-service guidance",
            escalation_type=None,
        )
