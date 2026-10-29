"""Comment service — business logic for comment submission and moderation."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.post import Post
from app.schemas.comment import CommentCreate, SuggestionCreate

# Simple keyword blocklist for spam filtering.
_SPAM_KEYWORDS: set[str] = {
    "buy now",
    "free money",
    "click here",
    "casino",
    "viagra",
    "crypto airdrop",
}


def _is_spam(text: str) -> bool:
    """Check if text contains known spam keywords (case-insensitive)."""
    lower = text.lower()
    return any(keyword in lower for keyword in _SPAM_KEYWORDS)


async def create_comment(
    db: AsyncSession,
    data: CommentCreate,
    owner_id: uuid.UUID,
) -> Comment:
    """Create a comment after spam checks.

    The honeypot check is handled at the schema level (``max_length=0``).
    This function handles keyword-based filtering and post existence validation.
    """
    # Verify the post exists and is published.
    post_result = await db.execute(
        select(Post.id).where(
            Post.id == data.post_id,
            Post.status == "published",
            Post.deleted_at.is_(None),
        )
    )
    if post_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )

    # Keyword-based spam check.
    if _is_spam(data.body):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment rejected by spam filter.",
        )

    comment = Comment(
        post_id=data.post_id,
        owner_id=owner_id,
        display_name=data.display_name,
        body=data.body,
        status="approved",
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


async def list_approved_comments(
    db: AsyncSession,
    post_id: uuid.UUID,
) -> list[Comment]:
    """Return all approved comments for a post, oldest first."""
    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.status == "approved")
        .order_by(Comment.created_at.asc())
    )
    return list(result.scalars().all())


async def delete_comment(
    db: AsyncSession,
    comment_id: uuid.UUID,
) -> bool:
    """Delete a comment by ID (admin action). Returns ``False`` if not found."""
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        return False

    await db.delete(comment)
    await db.flush()
    return True


async def create_suggestion(
    db: AsyncSession,
    post: Post,
    data: SuggestionCreate,
) -> Comment:
    """Store a preview reader's suggestion as a ``status="suggestion"`` comment.

    Suggestions ride on the comments table so they need no migration, and they
    can never appear publicly: every public read filters ``status="approved"``.
    The quoted passage is kept as a markdown blockquote ahead of the note.
    """
    if _is_spam(data.body) or _is_spam(data.quote):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suggestion rejected by spam filter.",
        )

    quote = "\n".join(f"> {line}" for line in data.quote.strip().splitlines())
    comment = Comment(
        post_id=post.id,
        owner_id=post.owner_id,
        display_name=data.display_name,
        body=f"{quote}\n\n{data.body}" if quote else data.body,
        status="suggestion",
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


async def list_suggestions(
    db: AsyncSession,
    post_id: uuid.UUID,
) -> list[Comment]:
    """Return a post's open suggestions, oldest first (admin view)."""
    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.status == "suggestion")
        .order_by(Comment.created_at.asc())
    )
    return list(result.scalars().all())
