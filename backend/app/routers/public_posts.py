"""Public post and series endpoints — no authentication required."""

import math
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.preview import read_preview_token
from app.db.base import get_db
from app.middleware.rate_limit import suggestion_rate_limiter
from app.models.post import Post
from app.schemas.comment import CommentResponse, SuggestionCreate
from app.schemas.common import PaginatedResponse
from app.schemas.post import PostListItem, PostResponse, PreviewResponse
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse
from app.schemas.series import SeriesListItem, SeriesResponse
from app.services import post_service, category_service, tag_service, series_service, comment_service

router = APIRouter(prefix="", tags=["Public API"])

@router.get("/categories", response_model=list[CategoryResponse])
async def get_public_categories(db: Annotated[AsyncSession, Depends(get_db)]):
    """List all categories for the public feed."""
    return await category_service.list_categories(db)

@router.get("/tags", response_model=list[TagResponse])
async def get_public_tags(db: Annotated[AsyncSession, Depends(get_db)]):
    """List all tags for the public feed."""
    return await tag_service.list_tags(db)

@router.get("/series", response_model=list[SeriesListItem])
async def list_public_series(db: Annotated[AsyncSession, Depends(get_db)]):
    """List all published series with post counts."""
    return await series_service.list_published_series(db)


@router.get("/series/{slug}", response_model=SeriesResponse)
async def get_series(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single published series with its ordered posts."""
    series = await series_service.get_series_by_slug(db, slug)
    if series is None or series.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found.",
        )
    return series

@router.get("/posts", response_model=PaginatedResponse[PostListItem])
async def list_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = Query(None, description="Filter by category slug"),
    tag: str | None = Query(None, description="Filter by tag slug"),
    series: str | None = Query(None, description="Filter by series slug"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=50, description="Items per page"),
):
    """List published posts with optional category/tag/series filters."""
    posts, total = await post_service.list_published_posts(
        db,
        category_slug=category,
        tag_slug=tag,
        series_slug=series,
        page=page,
        limit=limit,
    )
    return PaginatedResponse(
        items=posts,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 0,
    )


@router.get("/posts/{slug}", response_model=PostResponse)
async def get_post(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single published post by slug."""
    post = await post_service.get_published_post_by_slug(db, slug)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )
    return post


# Drafts are private: the response must never be stored by a browser, CDN or
# proxy, and the token in the URL must not leak onward through Referer.
_PREVIEW_HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


async def _open_preview(db: AsyncSession, token: str) -> tuple[Post, bool, datetime]:
    """Resolve a preview token to its post, or 404 — one answer for every failure.

    Expired, forged and deleted-post links all look the same, so a link
    reveals nothing about why it stopped working.
    """
    grant = read_preview_token(token)
    post = await post_service.get_admin_post_by_id(db, grant[0]) if grant else None
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preview not found.",
            headers=_PREVIEW_HEADERS,
        )
    return post, grant[1], grant[2]


@router.get("/preview/{token}", response_model=PreviewResponse)
async def get_preview(
    token: str,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Open a post of any status through a signed, expiring preview link."""
    post, can_suggest, expires_at = await _open_preview(db, token)
    response.headers.update(_PREVIEW_HEADERS)
    return PreviewResponse(post=post, can_suggest=can_suggest, expires_at=expires_at)


@router.post(
    "/preview/{token}/suggestions",
    response_model=CommentResponse,
    status_code=201,
)
async def submit_suggestion(
    token: str,
    data: SuggestionCreate,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Leave a suggested edit, if the preview link allows it."""
    suggestion_rate_limiter.check(request)
    post, can_suggest, _ = await _open_preview(db, token)
    if not can_suggest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This preview link does not accept suggestions.",
        )
    response.headers.update(_PREVIEW_HEADERS)
    return await comment_service.create_suggestion(db, post, data)
