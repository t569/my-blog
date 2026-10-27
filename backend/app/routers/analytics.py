"""Site analytics — a page-view beacon (public) and its summary (admin).

Cookieless, the way Plausible counts: a visitor is
``sha256(secret, UTC day, IP, user agent)``. Nothing that identifies a person
is stored, and the same reader is a new visitor tomorrow — so "visitors" means
visitor-days, and returning-visitor figures are impossible by design.
"""

import hashlib
import re
from datetime import date, datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.config import settings
from app.db.base import get_db
from app.middleware.rate_limit import RateLimiter, client_ip
from app.models.page_view import PageView

router = APIRouter(tags=["Analytics (Public)"])
admin_router = APIRouter(
    prefix="/admin/analytics",
    tags=["Analytics (Admin)"],
    dependencies=[Depends(get_current_admin)],
)

# Generous for a reader, a ceiling for anyone inflating the numbers.
view_rate_limiter = RateLimiter(max_requests=300, window_seconds=3600)

# ponytail: crawlers that run JS and say so. Ones that lie get counted; a
# proper list (e.g. the crawler-user-agents dataset) if they ever show up.
_BOT = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse", re.I)


class PageViewIn(BaseModel):
    path: str = Field(max_length=512, pattern=r"^/")
    referrer: str | None = Field(default=None, max_length=2048)


def _visitor(request: Request) -> str:
    day = datetime.now(timezone.utc).date().isoformat()
    ua = request.headers.get("user-agent", "")
    raw = f"{settings.NEXTAUTH_SECRET}|{day}|{client_ip(request)}|{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _referrer_host(referrer: str | None, own_host: str | None) -> str | None:
    """External host only; links from the site itself count as direct."""
    host = urlsplit(referrer or "").hostname
    if not host or (own_host and host == own_host.split(":")[0]):
        return None
    return host.removeprefix("www.")


@router.post("/analytics/view", status_code=204)
async def record_view(
    data: PageViewIn,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Record one page load. Sent by the browser as a beacon; never answered."""
    view_rate_limiter.check(request)
    if not _BOT.search(request.headers.get("user-agent", "")):
        db.add(
            PageView(
                path=data.path,
                referrer=_referrer_host(
                    data.referrer, request.headers.get("x-forwarded-host")
                ),
                visitor=_visitor(request),
            )
        )
    return Response(status_code=204)


@admin_router.get("")
async def summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=365),
):
    """Traffic over the last ``days`` UTC days, shaped for the dashboard charts."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    since = {"since": datetime.combine(start, datetime.min.time(), timezone.utc)}

    rows = await db.execute(
        text(
            """
            SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
                   count(*) AS views, count(DISTINCT visitor) AS visitors
            FROM page_views WHERE created_at >= :since
            GROUP BY day
            """
        ),
        since,
    )
    by_day: dict[date, tuple[int, int]] = {r.day: (r.views, r.visitors) for r in rows}
    # Every day present, so a quiet day is a gap in the chart, not a missing bar.
    daily = []
    for i in range(days):
        day = start + timedelta(days=i)
        views, visitors = by_day.get(day, (0, 0))
        daily.append({"date": day.isoformat(), "views": views, "visitors": visitors})

    referrers = await db.execute(
        text(
            """
            SELECT coalesce(referrer, 'Direct') AS label, count(DISTINCT visitor) AS value
            FROM page_views WHERE created_at >= :since
            GROUP BY label ORDER BY value DESC
            """
        ),
        since,
    )
    sources = [{"label": r.label, "value": r.value} for r in referrers]
    # Five slices and the rest, so the donut stays readable.
    if len(sources) > 6:
        sources = sources[:5] + [
            {"label": "Other", "value": sum(s["value"] for s in sources[5:])}
        ]

    pages = await db.execute(
        text(
            """
            SELECT path, count(*) AS views FROM page_views
            WHERE created_at >= :since
            GROUP BY path ORDER BY views DESC LIMIT 10
            """
        ),
        since,
    )

    # Nested stages, so each one is a subset of the one above.
    funnel = (
        await db.execute(
            text(
                """
                WITH v AS (
                  SELECT visitor,
                         count(DISTINCT path) FILTER (WHERE path LIKE '/posts/%') AS posts
                  FROM page_views WHERE created_at >= :since GROUP BY visitor
                )
                SELECT count(*) AS visitors,
                       count(*) FILTER (WHERE posts >= 1) AS one,
                       count(*) FILTER (WHERE posts >= 2) AS two,
                       count(*) FILTER (WHERE posts >= 3) AS three
                FROM v
                """
            ),
            since,
        )
    ).one()

    return {
        "days": days,
        "totals": {
            "views": sum(d["views"] for d in daily),
            "visitors": funnel.visitors,
        },
        "daily": daily,
        "referrers": sources,
        "top_pages": [{"path": r.path, "views": r.views} for r in pages],
        "funnel": [
            {"label": "Visits", "value": funnel.visitors},
            {"label": "Read a post", "value": funnel.one},
            {"label": "Read 2+ posts", "value": funnel.two},
            {"label": "Read 3+ posts", "value": funnel.three},
        ],
    }
