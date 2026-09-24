"""Faces for the chat assistant and the agents.

Stored on the single owner row as ``owners.characters``:
``{character_id: {"style": str, "seed": str, "image_url": str | None}}``.
A missing id means "the built-in face", which the frontend owns — the backend
only validates and stores, it never needs to know what a style looks like.

Reads and writes go through SQL on that one column rather than the ORM, and a
database the migration hasn't reached yet reads as "no choices" and refuses
writes with a message that says what to run. Every other owner query keeps
working either way (the column is deferred on the model).
"""

import json
import logging
import re

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

#: The assistant plus one per node of the agent pipeline
#: (app/devspace_agents/pipeline/graph.py). Order is display order.
CHARACTER_IDS = ("assistant", "orchestrator", "research", "context", "tone", "writer")

#: Readable by anyone: the reader-facing widget needs the assistant's face.
PUBLIC_IDS = ("assistant",)

_STYLE = re.compile(r"^[a-z][a-z0-9-]{1,39}$")

MIGRATION_HINT = "Character storage isn't set up yet — run `alembic upgrade head` in backend/."


def _missing_column(err: DBAPIError) -> bool:
    return "characters" in str(err.orig) and ("does not exist" in str(err.orig) or "UndefinedColumn" in str(err.orig))


def clean(raw: dict) -> dict:
    """Keep only known ids and well-formed fields. Raises 422 on anything else.

    ``image_url`` must be https: it ends up in an <image href> on a public
    page, and only an https URL (the upload endpoint returns Cloudinary ones)
    can't carry a script.
    """
    out: dict = {}
    for cid, choice in raw.items():
        if cid not in CHARACTER_IDS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"unknown character {cid!r}")
        if choice is None:
            continue  # cleared → built-in face
        if not isinstance(choice, dict):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{cid} must be an object")
        style, seed, image = choice.get("style"), choice.get("seed"), choice.get("image_url")
        if not (isinstance(style, str) and _STYLE.match(style)):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{cid}.style is not a style name")
        if not (isinstance(seed, str) and 0 < len(seed) <= 64):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{cid}.seed must be 1–64 characters")
        if image is not None and not (isinstance(image, str) and image.startswith("https://") and len(image) <= 500):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{cid}.image_url must be an https URL")
        out[cid] = {"style": style, "seed": seed, "image_url": image}
    return out


async def get_characters(db: AsyncSession) -> tuple[dict, bool]:
    """``(choices, ready)`` — ``ready`` is False when the column doesn't exist yet."""
    try:
        row = (await db.execute(text("SELECT characters FROM owners LIMIT 1"))).first()
    except DBAPIError as err:
        if _missing_column(err):
            await db.rollback()
            return {}, False
        raise
    return (dict(row[0] or {}) if row else {}), True


async def set_characters(db: AsyncSession, updates: dict) -> dict:
    """Merge ``updates`` over the stored choices. ``None`` for an id clears it."""
    current, ready = await get_characters(db)
    if not ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, MIGRATION_HINT)
    merged = {**current, **clean({k: v for k, v in updates.items() if v is not None})}
    for cid, choice in updates.items():
        if choice is None:
            merged.pop(cid, None)
    await db.execute(
        text("UPDATE owners SET characters = CAST(:c AS jsonb)"),
        {"c": json.dumps(merged)},
    )
    await db.commit()
    return merged
