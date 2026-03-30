import asyncio
import logging
from telegram.ext import Application
from src.config import Config
from src.bot.handlers import register_handlers
from src.utils.logger import setup_logger
from src.utils.openai_client import OpenAIClient

logger = setup_logger(__name__)

async def main():
    config = Config.from_env()
    config.validate()

    # Initialize OpenAI client
    openai_client = OpenAIClient(
        api_key=config.openai_api_key,
        model=config.openai_model,
    )

    application = Application.builder().token(config.telegram_bot_token).build()

    # Store openai_client in bot_data for handlers to access
    application.bot_data["openai_client"] = openai_client

    register_handlers(application)

    logger.info("N1 Support Bot starting...")
    await application.run_polling()

if __name__ == "__main__":
    asyncio.run(main())
