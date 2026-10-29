"""Post request/response schemas."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

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


def _dedupe(names: list[str]) -> list[str]:
    """Drop repeats (case-insensitively), keeping the first spelling and the order."""
    seen: set[str] = set()
    kept: list[str] = []
    for name in names:
        if name.casefold() not in seen:
            seen.add(name.casefold())
            kept.append(name)
    return kept


# Names are shown as plain text (React escapes them), so only size is policed.
Collaborators = Annotated[
    list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]],
    Field(max_length=20),
    AfterValidator(_dedupe),
]


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
    collaborators: Collaborators = Field(default_factory=list)
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
    collaborators: Collaborators | None = None
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
    collaborators: list[str] = []
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


class PreviewLinkCreate(BaseModel):
    """Request body for minting a draft preview link."""

    hours: int = Field(default=72, ge=1, le=720)
    suggest: bool = False


class PreviewLinkResponse(BaseModel):
    token: str
    expires_at: datetime


class PreviewResponse(BaseModel):
    """A post opened through a preview link, and what the link allows."""

    post: PostResponse
    can_suggest: bool
    expires_at: datetime
