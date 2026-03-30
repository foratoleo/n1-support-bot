"""OpenAI embedding generation for RAG knowledge base."""

from openai import OpenAI
from typing import List


class EmbeddingGenerator:
    """Generates text embeddings using OpenAI API."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        """Initialize the embedding generator.

        Args:
            api_key: OpenAI API key.
            model: Embedding model to use. Defaults to text-embedding-3-small.
        """
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text.

        Args:
            text: The text to embed.

        Returns:
            List of floats representing the embedding vector.
        """
        response = self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding

    def batch_embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts with batching.

        Args:
            texts: List of texts to embed.

        Returns:
            List of embedding vectors, one for each input text.
        """
        response = self.client.embeddings.create(
            model=self.model,
            input=texts
        )
        return [item.embedding for item in response.data]
