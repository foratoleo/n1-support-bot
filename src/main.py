import asyncio
import logging
import os
from telegram.ext import Application
from src.config import Config
from src.bot.handlers import register_handlers
from src.utils.logger import setup_logger
from src.utils.openai_client import OpenAIClient

logger = setup_logger(__name__)


def main():
    config = Config.from_env()
    config.validate()
    logger.info("N1 Support Bot starting...")

    async def _main():
        # Initialize database pool
        from src.database.connection import init_database_pool
        pool = await init_database_pool()
        await pool.initialize()
        logger.info("Database pool connected")

        # Initialize OpenAI client (MiniMax-compatible)
        openai_client = OpenAIClient(
            api_key=config.openai_api_key,
            model=config.openai_model,
            base_url=config.openai_base_url,
        )

        application = Application.builder().token(config.telegram_bot_token).build()
        application.bot_data["openai_client"] = openai_client
        register_handlers(application)

        await application.initialize()
        await application.start()
        await application.updater.start_polling(drop_pending_updates=True)
        logger.info("Bot is polling.")

        # Keep running
        shutdown_event = asyncio.Event()

        def on_shutdown():
            shutdown_event.set()

        try:
            await shutdown_event.wait()
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            logger.info("Shutting down...")
            await application.stop()
            await application.shutdown()
            await pool.close()
            logger.info("Shutdown complete.")

    asyncio.run(_main())


if __name__ == "__main__":
    main()
