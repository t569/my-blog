"""d3jusdevspace — FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.db.base import async_session_factory, engine
from app.routers import (
    admin_agent,
    admin_categories,
    admin_comments,
    admin_context,
    admin_features,
    admin_posts,
    admin_series,
    admin_tags,
    admin_uploads,
    debug,
    public_comments,
    public_posts,
    public_search,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Manage application startup and shutdown."""
    # Startup — verify the database is reachable.
    async with engine.connect() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )

    # Startup — load AgentSchedule and start the scheduler if active.
    try:
        from app.devspace_agents.scheduler import start_scheduler
        from app.models.agent import AgentSchedule

        async with async_session_factory() as session:
            schedule = (
                await session.execute(
                    select(AgentSchedule).where(AgentSchedule.is_active == True)
                )
            ).scalar_one_or_none()
            if schedule:
                await start_scheduler(schedule.owner_id, schedule.cron_expr)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Failed to start agent scheduler")

    yield

    # Shutdown: stop scheduler, flush LangFuse, close DB pool.
    try:
        from app.devspace_agents.langfuse.client import langfuse
        from app.devspace_agents.scheduler import stop_scheduler

        stop_scheduler()
        langfuse.flush()
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Error during shutdown")

    await engine.dispose()


app = FastAPI(
    title="d3jusdevspace API",
    description="Personal AI knowledge hub and blog backend.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers — all prefixed under /api/v1
# ---------------------------------------------------------------------------

API_V1 = "/api/v1"

app.include_router(public_posts.router, prefix=API_V1)
app.include_router(public_comments.router, prefix=API_V1)
app.include_router(public_search.router, prefix=API_V1)
app.include_router(admin_posts.router, prefix=API_V1)
app.include_router(admin_categories.router, prefix=API_V1)
app.include_router(admin_series.router, prefix=API_V1)
app.include_router(admin_tags.router, prefix=API_V1)
app.include_router(admin_uploads.router, prefix=API_V1)
app.include_router(admin_comments.router, prefix=API_V1)
app.include_router(admin_context.router, prefix=API_V1)
app.include_router(admin_agent.router, prefix=API_V1)
app.include_router(admin_features.router, prefix=API_V1)
app.include_router(debug.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


# Which commit is actually serving. Hosts inject this themselves — Render as
# RENDER_GIT_COMMIT, Railway as RAILWAY_GIT_COMMIT_SHA — and GIT_COMMIT covers
# anything else, so nothing has to be set by hand.
#
# Worth having because "did that push actually deploy?" is otherwise only
# answerable from a dashboard. A deploy that half-lands — one host on the new
# commit, the other still on the old one — produces no error anywhere and reads
# exactly like a caching problem.
_COMMIT = (
    os.getenv("RENDER_GIT_COMMIT")
    or os.getenv("RAILWAY_GIT_COMMIT_SHA")
    or os.getenv("GIT_COMMIT")
)


@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    # Key omitted rather than reported as "unknown" when running locally, where
    # there is no deploy to identify.
    return {"status": "ok", **({"commit": _COMMIT[:7]} if _COMMIT else {})}
