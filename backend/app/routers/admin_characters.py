"""Admin character (avatar) endpoints — authentication required."""

from typing import Annotated

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.db.base import get_db
from app.services import character_service

router = APIRouter(
    prefix="/admin/characters",
    tags=["Characters (Admin)"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("")
async def list_characters(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Every character id, its stored choice (or null for the built-in face), and
    whether storage exists yet."""
    choices, ready = await character_service.get_characters(db)
    return {
        "ready": ready,
        "hint": None if ready else character_service.MIGRATION_HINT,
        "characters": {cid: choices.get(cid) for cid in character_service.CHARACTER_IDS},
    }


@router.put("")
async def update_characters(
    db: Annotated[AsyncSession, Depends(get_db)],
    updates: Annotated[dict, Body(...)],
) -> dict:
    """Merge choices in; ``null`` for an id restores its built-in face."""
    merged = await character_service.set_characters(db, updates)
    return {
        "ready": True,
        "hint": None,
        "characters": {cid: merged.get(cid) for cid in character_service.CHARACTER_IDS},
    }
