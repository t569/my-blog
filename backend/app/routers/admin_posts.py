"""Admin post management endpoints — authentication required."""

import math
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.db.base import get_db
from app.models.owner import Owner
from app.auth.preview import make_preview_token
from app.schemas.comment import CommentResponse
from app.schemas.common import AdminStatsResponse, MessageResponse, PaginatedResponse
from app.schemas.post import (
    PostCreate,
    PostListItem,
    PostResponse,
    PostUpdate,
    PreviewLinkCreate,
    PreviewLinkResponse,
)
from app.services import comment_service, post_service
from app.services.embedding_service import generate_embeddings_background
from app.services.stats_service import get_admin_stats

router = APIRouter(
    prefix="/admin/posts",
    tags=["Posts (Admin)"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    """Return aggregated dashboard statistics, scoped to the authenticated admin."""
    return await get_admin_stats(db, admin.id)


@router.get("", response_model=PaginatedResponse[PostListItem])
async def list_all_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by status: draft, published, archived, agent_draft",
    ),
    is_agent_authored: bool | None = Query(
        None,
        description="Filter by agent-authored posts",
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List all posts (all statuses) for admin management."""
    posts, total = await post_service.list_all_posts(
        db, status_filter=status_filter, is_agent_authored=is_agent_authored, page=page, limit=limit
    )
    return PaginatedResponse(
        items=posts,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 0,
    )


@router.get("/{post_id}", response_model=PostResponse)
async def get_admin_post(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single post by ID (for admin editing, ignores status)."""
    post = await post_service.get_admin_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    return post


@router.post("", response_model=PostResponse, status_code=201)
async def create_post(
    data: PostCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
    background_tasks: BackgroundTasks,
):
    """Create a new post."""
    post = await post_service.create_post(db, data, admin.id)
    # Committed here, not by get_db: since FastAPI 0.118 a yield dependency's
    # exit runs after the response *and its background tasks*, so the embedder
    # would read the old row and a failed late commit would still answer 200.
    await db.commit()
    background_tasks.add_task(generate_embeddings_background, post.id)
    return post


@router.patch("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: uuid.UUID,
    data: PostUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    """Update an existing post."""
    post = await post_service.update_post(db, post_id, data)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    await db.commit()  # before the background task — see create_post
    # Re-generate embeddings if content or title changed.
    update_fields = data.model_dump(exclude_unset=True)
    if any(f in update_fields for f in ("title", "content")):
        background_tasks.add_task(generate_embeddings_background, post.id)
    return post


@router.delete("/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Soft-delete a post (sets ``deleted_at``)."""
    post = await post_service.soft_delete_post(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    return MessageResponse(detail="Post deleted.")


@router.post("/{post_id}/preview-link", response_model=PreviewLinkResponse)
async def create_preview_link(
    post_id: uuid.UUID,
    data: PreviewLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mint a signed, expiring link that opens this post whatever its status."""
    if await post_service.get_admin_post_by_id(db, post_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    minted = make_preview_token(post_id, data.hours, data.suggest)
    if minted is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Preview links are not configured (set PREVIEW_SECRET).",
        )
    token, expires_at = minted
    return PreviewLinkResponse(token=token, expires_at=expires_at)


@router.get("/{post_id}/suggestions", response_model=list[CommentResponse])
async def list_post_suggestions(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Open suggestions left through preview links. Dismiss via DELETE /admin/comments/{id}."""
    return await comment_service.list_suggestions(db, post_id)
