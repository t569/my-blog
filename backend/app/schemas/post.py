"""Post request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse


class PostSeriesInfo(BaseModel):
    """Minimal series info embedded in post responses."""

    id: uuid.UUID
    title: str
    slug: str
    series_order: int | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class PostCreate(BaseModel):
    """Request body for creating a post."""

    title: str = Field(..., min_length=1, max_length=300)
    # Optional: absent or blank, the slug is derived from the title. Present, it
    # is slugified and de-duplicated the same way, so an author can choose the
    # URL without being able to mint an invalid or colliding one.
    slug: str | None = Field(None, max_length=350)
    content: str = Field(..., min_length=1)
    category_id: uuid.UUID
    tags: list[str] = Field(default_factory=list)
    series_id: uuid.UUID | None = None
    series_order: int | None = Field(None, ge=1)
    status: str = Field(default="draft", pattern=r"^(draft|published)$")
    is_agent_authored: bool = False


class PostUpdate(BaseModel):
    """Request body for updating a post. All fields optional."""

    title: str | None = Field(None, min_length=1, max_length=300)
    slug: str | None = Field(None, min_length=1, max_length=350)
    content: str | None = Field(None, min_length=1)
    category_id: uuid.UUID | None = None
    tags: list[str] | None = None
    series_id: uuid.UUID | None = None
    series_order: int | None = Field(None, ge=1)
    status: str | None = Field(
        None,
        pattern=r"^(draft|published|archived)$",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class PostResponse(BaseModel):
    """Full post data returned to clients."""

    id: uuid.UUID
    title: str
    slug: str
    content: str
    excerpt: str | None
    category: CategoryResponse
    tags: list[TagResponse]
    series: PostSeriesInfo | None = None
    status: str
    is_agent_authored: bool
    reading_time_mins: int | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    #: First https image in the content, if any (Post.cover_image).
    cover_image: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PostListItem(BaseModel):
    """Lightweight post data for feed/list views — no full content."""

    id: uuid.UUID
    title: str
    slug: str
    excerpt: str | None
    category: CategoryResponse
    tags: list[TagResponse]
    series: PostSeriesInfo | None = None
    status: str
    is_agent_authored: bool
    reading_time_mins: int | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
