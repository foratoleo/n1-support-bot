"""PostgreSQL connection pool and session management.

Uses asyncpg for async database operations with a connection pool
managed by SQLAlchemy's async engine.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")

def _make_async_url(url: str) -> str:
    """Convert postgresql:// to postgresql+asyncpg:// for async SQLAlchemy."""
    if url and url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


class DatabasePool:
    """Async PostgreSQL connection pool manager.

    Provides connection pooling and session management for the database
    using SQLAlchemy async engine with asyncpg driver.

    Attributes:
        database_url: PostgreSQL connection string.
        engine: SQLAlchemy async engine instance.
        session_factory: Session factory for creating database sessions.
    """

    def __init__(self, database_url: str) -> None:
        """Initialize database pool with connection string.

        Args:
            database_url: PostgreSQL connection URL in format:
                postgresql+asyncpg://user:pass@host:port/dbname
        """
        self.database_url = database_url
        self.engine: Optional[AsyncEngine] = None
        self.session_factory: Optional[sessionmaker[AsyncSession]] = None

    async def initialize(self) -> None:
        """Create the async engine and session factory.

        Sets up connection pooling with appropriate parameters for
        production use.
        """
        async_url = _make_async_url(self.database_url)
        self.engine = create_async_engine(
            async_url,
            echo=False,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        self.session_factory = sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
        logger.info("Database pool initialized successfully")

    async def close(self) -> None:
        """Close the database engine and release all connections."""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database pool closed")

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[AsyncSession, None]:
        """Acquire a database session from the pool.

        Yields:
            AsyncSession: Database session for executing queries.

        Raises:
            RuntimeError: If pool is not initialized.
        """
        if self.session_factory is None:
            raise RuntimeError("Database pool not initialized. Call initialize() first.")

        async with self.session_factory() as session:
            try:
                yield session
            except Exception as e:
                await session.rollback()
                logger.error(f"Database session error: {e}")
                raise

    async def init_database(self) -> None:
        """Create the rag schema and tables if they do not exist.

        Initializes the database schema by creating the 'rag' schema
        and all required tables based on SQLAlchemy models.
        """
        from .models import Base

        if self.engine is None:
            raise RuntimeError("Database pool not initialized. Call initialize() first.")

        async with self.engine.begin() as conn:
            # Create rag schema if not exists
            await conn.execute(
                create_schema_if_not_exists("rag")
            )

            # Create all tables
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database schema initialized")

    def create_session(self) -> AsyncSession:
        """Create a new database session.

        Returns:
            AsyncSession: New database session. Caller must manage
                session lifecycle (commit/rollback/close).

        Raises:
            RuntimeError: If pool is not initialized.
        """
        if self.session_factory is None:
            raise RuntimeError("Database pool not initialized. Call initialize() first.")
        return self.session_factory()


def create_schema_if_not_exists(schema_name: str):
    """Create a PostgreSQL schema if it does not already exist.

    Args:
        schema_name: Name of the schema to create.
    """
    from sqlalchemy import text
    return text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")


# Global database pool instance
_pool: Optional[DatabasePool] = None


def get_database_pool() -> DatabasePool:
    """Get the global database pool instance.

    Returns:
        DatabasePool: The global pool instance.

    Raises:
        ValueError: If DATABASE_URL environment variable is not set.
    """
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is not set")
        _pool = DatabasePool(DATABASE_URL)
    return _pool


async def init_database_pool() -> DatabasePool:
    """Initialize and return the global database pool.

    Returns:
        DatabasePool: Initialized database pool.
    """
    pool = get_database_pool()
    await pool.initialize()
    await pool.init_database()
    return pool


async def close_database_pool() -> None:
    """Close the global database pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
