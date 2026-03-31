import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    # Required
    telegram_bot_token: str
    openai_api_key: str
    database_url: str

    # Optional
    openai_model: str = "MiniMax-M2"
    rag_schema: str = "rag"
    openai_base_url: str = "https://api.minimax.io/v1"
    log_level: str = "INFO"
    use_pgvector: bool = False

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            database_url=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/n1_support"),
            openai_model=os.getenv("OPENAI_MODEL", "MiniMax-M2"),
            rag_schema=os.getenv("RAG_SCHEMA", "rag"),
            openai_base_url=os.getenv("OPENAI_BASE_URL", "https://api.minimax.io/v1"),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            use_pgvector=os.getenv("USE_PGVECTOR", "false").lower() == "true",
        )

    def validate(self) -> bool:
        """Validate required configuration."""
        if not self.telegram_bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN is required")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required")
        return True
