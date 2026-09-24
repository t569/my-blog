"""Admin site-index endpoints — authentication required."""

from dataclasses import asdict
from urllib.parse import urlparse
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
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
        "site_url": settings.SITE_URL or (report.site_url if report else None),
        "passages": await site_index.counts(db),
        "last_rebuild": asdict(report) if report else None,
        "running": site_index._lock.locked(),
    }


async def _rebuild(site_url: str | None) -> None:
    async with async_session_factory() as db:
        await site_index.rebuild(db, site_url)


def site_from(request: Request) -> str | None:
    """The site this admin is working on: the request's Origin — accepted only
    when the platform vouches for it, so a caller can't aim the crawler at
    another host:

    - it matches ``x-forwarded-host``, which the hosting edge (Vercel) sets to
      the domain the request actually arrived on and a browser can't forge;
      the site's /api/proxy passes it through — so a deployed site needs no
      configuration; or
    - it is one of CORS_ORIGINS (how local development is recognised).
    """
    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin:
        return None
    parsed = urlparse(origin)
    forwarded = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    if parsed.scheme == "https" and forwarded and parsed.netloc == forwarded:
        return origin
    allowed = {o.rstrip("/") for o in settings.cors_origin_list if o}
    return origin if origin in allowed else None


@router.post("/rebuild", status_code=202)
async def rebuild(request: Request, background: BackgroundTasks) -> dict:
    """Start a rebuild in the background — a crawl plus embeddings can outlast
    the proxy's 60s. Poll GET for the result. Unchanged pages cost nothing.

    Crawls the site the request came from (see `site_from`), or SITE_URL if set."""
    site = site_from(request)
    if not site_index._lock.locked():
        background.add_task(_rebuild, site)
    return {"started": True, "site_url": settings.SITE_URL or site}
