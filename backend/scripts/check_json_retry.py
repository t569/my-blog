"""Self-check: Groq's own JSON rejections are retried, nothing else is.

Run:  python -m scripts.check_json_retry   (from backend/)

No model, no database, no network.
"""

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")

import httpx  # noqa: E402
from groq import BadRequestError  # noqa: E402

from app.devspace_agents.llm import create_json  # noqa: E402


def _400(code: str) -> BadRequestError:
    response = httpx.Response(400, request=httpx.Request("POST", "http://groq"))
    return BadRequestError(f"Error code: 400 - {{'error': {{'code': '{code}'}}}}", response=response, body=None)


def _client(side_effect) -> MagicMock:
    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=side_effect)
    return client


async def main() -> None:
    client = _client([_400("json_validate_failed"), "ok"])
    assert await create_json(client, model="m") == "ok"
    assert client.chat.completions.create.call_args.kwargs["response_format"] == {"type": "json_object"}

    for code, calls in (("model_not_found", 1), ("json_validate_failed", 3)):
        client = _client(_400(code))
        try:
            await create_json(client, model="m")
        except BadRequestError:
            assert client.chat.completions.create.await_count == calls, code
        else:
            raise AssertionError(f"{code} should raise")

    print("ok")


if __name__ == "__main__":
    asyncio.run(main())
