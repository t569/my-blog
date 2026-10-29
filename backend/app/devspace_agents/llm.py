"""Groq JSON-mode completions, shared by every pipeline node."""

import logging

from groq import AsyncGroq, BadRequestError

logger = logging.getLogger(__name__)

# One stray character in the output (gpt-oss has closed an object with `)}`)
# and Groq rejects the whole generation with a 400 `json_validate_failed`.
# The nodes' own json.loads fallbacks never see it — the SDK raises first —
# so the run died. Sampling differs per call, so asking again usually works.
_ATTEMPTS = 3


async def create_json(client: AsyncGroq, **kwargs):
    """``chat.completions.create`` in JSON mode, retrying Groq's own JSON rejections."""
    for attempt in range(1, _ATTEMPTS + 1):
        try:
            return await client.chat.completions.create(
                response_format={"type": "json_object"}, **kwargs
            )
        except BadRequestError as exc:
            if "json_validate_failed" not in str(exc) or attempt == _ATTEMPTS:
                raise
            logger.warning("Groq rejected its own JSON (attempt %d) — retrying", attempt)
