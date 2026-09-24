"""The constellation — the site index as a graph. Public, read-only, cached."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.services import constellation

router = APIRouter(tags=["Constellation (Public)"])


@router.get("/constellation")
async def get_constellation(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Pages, their sections, and the lines between them: links and meaning.

    Everything in it is already public (the index holds only published posts
    and crawled public pages); no passage text is sent, only titles and links.
    """
    return await constellation.graph(db)
