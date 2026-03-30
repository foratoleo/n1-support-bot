"""RAG module for N1 Support Bot Telegram application.

This module provides retrieval-augmented generation capabilities for
the support bot, including embedding generation and knowledge base search.
"""

from .embeddings import EmbeddingGenerator
from .knowledge_base import KnowledgeBaseSearcher

__all__ = [
    "EmbeddingGenerator",
    "KnowledgeBaseSearcher",
]
