import asyncio
import logging
from telegram.ext import Application
from src.config import Config
from src.bot.handlers import register_handlers
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

async def main():
    config = Config.from_env()
    config.validate()

    application = Application.builder().token(config.telegram_bot_token).build()

    register_handlers(application)

    logger.info("N1 Support Bot starting...")
    await application.run_polling()

if __name__ == "__main__":
    asyncio.run(main())
