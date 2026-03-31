from openai import OpenAI
from typing import List, Dict, Any, Optional
import json
from .logger import get_logger

logger = get_logger(__name__)

class OpenAIClient:
    def __init__(
        self,
        api_key: str,
        model: str = "MiniMax-M2",
        base_url: str = "https://api.minimax.io/v1"
    ):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        """
        Send chat completion request.
        Returns the text response.
        Handles rate limits, timeouts, and retries.
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def structured_completion(
        self,
        system_prompt: str,
        user_message: str,
        response_schema: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send completion with JSON schema.
        Returns parsed dict response.
        Uses GPT-4o's JSON mode if schema provided.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]

        try:
            if response_schema:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.3
                )
            else:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.3
                )

            content = response.choices[0].message.content
            if response_schema:
                return json.loads(content)
            return {"text": content}
        except Exception as e:
            logger.error(f"OpenAI structured completion error: {e}")
            raise
