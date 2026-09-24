"""Post service — business logic for post CRUD operations."""

import math
import re
import uuid
from datetime import datetime

from slugify import slugify
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.post import Post, PostTag, Tag
from app.models.series import Series
from app.models.category import Category
from app.schemas.post import PostCreate, PostUpdate
from app.services import tag_service


# Average reading speed in words per minute.
_WORDS_PER_MINUTE = 200

# Maximum length for auto-generated excerpts.
_EXCERPT_LENGTH = 160


def _calculate_reading_time(content: str) -> int:
    """Estimate reading time in minutes (rounded up)."""
    word_count = len(content.split())
    return max(1, math.ceil(word_count / _WORDS_PER_MINUTE))


def _generate_excerpt(content: str) -> str:
    """Extract the first ``_EXCERPT_LENGTH`` characters of plain text.

    Strips markdown heading markers and trims to the nearest word boundary.
    """
    # Remove markdown headings, bold, italic, links, images.
    plain = re.sub(r"[#*_\[\]!()]", "", content)
    plain = re.sub(r"\s+", " ", plain).strip()

    if len(plain) <= _EXCERPT_LENGTH:
        return plain

    truncated = plain[:_EXCERPT_LENGTH]
    # Trim to last complete word.
    last_space = truncated.rfind(" ")
    if last_space > 0:
        truncated = truncated[:last_space]
    return truncated + "…"


async def _generate_unique_slug(
    db: AsyncSession,
    source: str,
    *,
    exclude_post_id: uuid.UUID | None = None,
) -> str:
    """Slugify ``source`` (a title, or a slug an author typed), de-duplicating it.

    Collisions get a ``-1``, ``-2`` suffix rather than an error, because the
    caller is creating a post and failing the whole save over a URL the author
    can still change is the worse outcome.
    """
    base_slug = slugify(source, max_length=300)
    slug = base_slug
    counter = 1

    while True:
        query = select(Post.id).where(Post.slug == slug)
        if exclude_post_id is not None:
            query = query.where(Post.id != exclude_post_id)
        result = await db.execute(query)
        if result.scalar_one_or_none() is None:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


async def list_published_posts(
    db: AsyncSession,
    *,
    category_slug: str | None = None,
    tag_slug: str | None = None,
    series_slug: str | None = None,
    page: int = 1,
    limit: int = 10,
) -> tuple[list[Post], int]:
    """Return published posts with pagination and optional filters.

    Returns a tuple of (posts, total_count).
    """
    query = (
        select(Post)
        .where(Post.status == "published", Post.deleted_at.is_(None))
        .order_by(Post.published_at.desc())
    )

    count_query = select(func.count(Post.id)).where(
        Post.status == "published",
        Post.deleted_at.is_(None),
    )

    if category_slug:
        query = query.join(Post.category).where(Category.slug == category_slug)
        count_query = (
            count_query.join(Post.category).where(Category.slug == category_slug)
        )

    if tag_slug:
        query = query.join(Post.tags).where(Tag.slug == tag_slug)
        count_query = count_query.join(Post.tags).where(Tag.slug == tag_slug)

    if series_slug:
        query = query.join(Post.series).where(Series.slug == series_slug)
        count_query = count_query.join(Post.series).where(
            Series.slug == series_slug
        )

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    posts = list(result.scalars().unique().all())

    return posts, total


async def get_published_post_by_slug(
    db: AsyncSession,
    slug: str,
) -> Post | None:
    """Fetch a single published post by its slug."""
    result = await db.execute(
        select(Post).where(
            Post.slug == slug,
            Post.status == "published",
            Post.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_all_posts(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    is_agent_authored: bool | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Post], int]:
    """Admin view — list all non-deleted posts with optional status filter."""
    query = select(Post).where(Post.deleted_at.is_(None)).order_by(Post.updated_at.desc())
    count_query = select(func.count(Post.id)).where(Post.deleted_at.is_(None))

    if status_filter:
        query = query.where(Post.status == status_filter)
        count_query = count_query.where(Post.status == status_filter)

    if is_agent_authored is not None:
        query = query.where(Post.is_agent_authored == is_agent_authored)
        count_query = count_query.where(Post.is_agent_authored == is_agent_authored)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    posts = list(result.scalars().unique().all())

    return posts, total


async def get_admin_post_by_id(
	db: AsyncSession,
	post_id: uuid.UUID,
) -> Post | None:
	"""Admin view — fetch a single post by ID (any status)."""
	result = await db.execute(
		select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
	)
	post = result.scalar_one_or_none()
	return post


async def create_post(
    db: AsyncSession,
    data: PostCreate,
    owner_id: uuid.UUID,
) -> Post:
    """Create a new post. The slug is the author's, or the title's if they gave none."""
    slug = await _generate_unique_slug(db, data.slug or data.title)
    excerpt = _generate_excerpt(data.content)
    reading_time = _calculate_reading_time(data.content)

    post = Post(
        owner_id=owner_id,
        title=data.title,
        slug=slug,
        content=data.content,
        excerpt=excerpt,
        category_id=data.category_id,
        series_id=data.series_id,
        series_order=data.series_order,
        status=data.status,
        reading_time_mins=reading_time,
        published_at=datetime.now() if data.status == "published" else None,
        is_agent_authored=data.is_agent_authored,
    )
    db.add(post)
    await db.flush()

    # Attach tags.
    if data.tags:
        for name in data.tags:
            tag = await tag_service.get_or_create_tag(db, name, owner_id)
            db.add(PostTag(id=uuid.uuid4(), post_id=post.id, tag_id=tag.id))
        await db.flush()

    # Refresh to load relationships for the response.
    await db.refresh(post, attribute_names=["category", "tags", "comments", "series"])
    return post


async def update_post(
    db: AsyncSession,
    post_id: uuid.UUID,
    data: PostUpdate,
) -> Post | None:
    """Update an existing post. Returns ``None`` if the post doesn't exist."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    post = result.scalar_one_or_none()
    if post is None:
        return None

    update_data = data.model_dump(exclude_unset=True)

    # Handle slug: if title changed but slug not explicitly set, regenerate.
    if "title" in update_data and "slug" not in update_data:
        update_data["slug"] = await _generate_unique_slug(
            db, update_data["title"], exclude_post_id=post_id
        )

    # If slug explicitly provided, validate uniqueness.
    if "slug" in update_data:
        slug_val = slugify(update_data["slug"], max_length=300)
        existing = await db.execute(
            select(Post.id).where(Post.slug == slug_val, Post.id != post_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slug '{slug_val}' is already in use.",
            )
        update_data["slug"] = slug_val

    # Recalculate derived fields if content changed.
    if "content" in update_data:
        update_data["excerpt"] = _generate_excerpt(update_data["content"])
        update_data["reading_time_mins"] = _calculate_reading_time(
            update_data["content"]
        )

    # Handle status transitions.
    if "status" in update_data:
        if update_data["status"] == "published" and post.published_at is None:
            update_data["published_at"] = datetime.now()

    # Handle tag reassignment.
    tags = update_data.pop("tags", None)
    if tags is not None:
        # Remove existing associations.
        await db.execute(delete(PostTag).where(PostTag.post_id == post_id))
        for name in tags:
            tag = await tag_service.get_or_create_tag(db, name, post.owner_id)
            db.add(PostTag(id=uuid.uuid4(), post_id=post_id, tag_id=tag.id))

    for field, value in update_data.items():
        setattr(post, field, value)

    await db.flush()
    await db.refresh(post, attribute_names=["category", "tags", "comments", "series"])
    return post


async def soft_delete_post(
    db: AsyncSession,
    post_id: uuid.UUID,
) -> Post | None:
    """Soft-delete a post by setting ``deleted_at``. Returns ``None`` if not found."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    post = result.scalar_one_or_none()
    if post is None:
        return None

    post.deleted_at = datetime.now()
    await db.flush()
    return post
