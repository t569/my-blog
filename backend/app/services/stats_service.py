"""Admin dashboard aggregation — owner-scoped counts across all models."""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentRun
from app.models.category import Category
from app.models.comment import Comment
from app.models.post import Post, Tag
from app.schemas.common import AdminStatsResponse


async def get_admin_stats(
    db: AsyncSession,
    owner_id: str,
) -> AdminStatsResponse:
    """Compute 11 aggregate counts for the admin dashboard, all scoped to ``owner_id``."""
    # Naive UTC cutoff to match AgentRun.started_at's non-timezone-aware column
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
    )

    # --- Posts ---
    total_posts = await db.scalar(
        select(func.count(Post.id)).where(
            Post.deleted_at.is_(None), Post.owner_id == owner_id
        )
    )
    published_posts = await db.scalar(
        select(func.count(Post.id)).where(
            Post.deleted_at.is_(None),
            Post.owner_id == owner_id,
            Post.status == "published",
        )
    )
    draft_posts = await db.scalar(
        select(func.count(Post.id)).where(
            Post.deleted_at.is_(None),
            Post.owner_id == owner_id,
            Post.status == "draft",
        )
    )
    agent_pending_posts = await db.scalar(
        select(func.count(Post.id)).where(
            Post.deleted_at.is_(None),
            Post.owner_id == owner_id,
            Post.status == "draft",
            Post.is_agent_authored.is_(True),
        )
    )

    # --- Comments ---
    total_comments = await db.scalar(
        select(func.count(Comment.id)).where(
            Comment.owner_id == owner_id, Comment.status != "suggestion"
        )
    )
    pending_comments = await db.scalar(
        select(func.count(Comment.id)).where(
            Comment.owner_id == owner_id,
            # Preview-link suggestions live in this table too, but they are
            # the editor's to-do list, not comments awaiting moderation.
            Comment.status.not_in(("approved", "suggestion")),
        )
    )

    # --- Taxonomy ---
    total_categories = await db.scalar(
        select(func.count(Category.id)).where(Category.owner_id == owner_id)
    )
    total_tags = await db.scalar(
        select(func.count(Tag.id)).where(Tag.owner_id == owner_id)
    )

    # --- Agent ---
    agent_runs_total = await db.scalar(
        select(func.count(AgentRun.id)).where(AgentRun.owner_id == owner_id)
    )
    agent_runs_failed = await db.scalar(
        select(func.count(AgentRun.id)).where(
            AgentRun.owner_id == owner_id,
            AgentRun.status == "failed",
        )
    )
    agent_runs_today = await db.scalar(
        select(func.count(AgentRun.id)).where(
            AgentRun.owner_id == owner_id,
            AgentRun.started_at >= today_start,
        )
    )

    return AdminStatsResponse(
        total_posts=total_posts or 0,
        published_posts=published_posts or 0,
        draft_posts=draft_posts or 0,
        agent_pending_posts=agent_pending_posts or 0,
        total_comments=total_comments or 0,
        pending_comments=pending_comments or 0,
        total_categories=total_categories or 0,
        total_tags=total_tags or 0,
        agent_runs_total=agent_runs_total or 0,
        agent_runs_failed=agent_runs_failed or 0,
        agent_runs_today=agent_runs_today or 0,
    )
