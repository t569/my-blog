"""Admin site-index endpoints — authentication required."""

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.config import settings
from app.db.base import async_session_factory, get_db
from app.services import site_index

router = APIRouter(
    prefix="/admin/site-index",
    tags=["Site index (Admin)"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("")
async def status(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """What is indexed, by kind, and how the last rebuild went."""
    report = site_index.last_report
    return {
        "site_url": settings.SITE_URL or None,
        "passages": await site_index.counts(db),
        "last_rebuild": asdict(report) if report else None,
        "running": site_index._lock.locked(),
    }


async def _rebuild() -> None:
    async with async_session_factory() as db:
        await site_index.rebuild(db)


@router.post("/rebuild", status_code=202)
async def rebuild(background: BackgroundTasks) -> dict:
    """Start a rebuild in the background — a crawl plus embeddings can outlast
    the proxy's 60s. Poll GET for the result. Unchanged pages cost nothing."""
    if not site_index._lock.locked():
        background.add_task(_rebuild)
    return {"started": True}
