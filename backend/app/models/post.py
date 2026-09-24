"""Post and Tag models with many-to-many association."""

import re
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PostTag(Base):
    """Association table for the many-to-many post ↔ tag relationship."""

    __tablename__ = "post_tags"
    __table_args__ = (
        UniqueConstraint("post_id", "tag_id", name="uq_post_tags_post_tag"),
    )

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("owner_id", "slug", name="uq_tags_owner_slug"),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("owners.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)

    # --- Relationships ---
    posts: Mapped[list["Post"]] = relationship(
        secondary="post_tags",
        back_populates="tags",
        lazy="noload",  # Loaded via post queries, not when fetching tags
    )


_FIRST_IMAGE = re.compile(
    r"!\[[^\]]*\]\((https://[^\s)]+)|<img[^>]+src=[\"'](https://[^\"']+)[\"']",
    re.IGNORECASE,
)


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index(
            "ix_posts_status_deleted_published",
            "status",
            "deleted_at",
            "published_at",
        ),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("owners.id"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="draft",
    )
    is_agent_authored: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    reading_time_mins: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    series_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("series.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    series_order: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.now,
        onupdate=datetime.now,
        nullable=False,
    )

    # --- Relationships ---
    category: Mapped["Category"] = relationship(  # noqa: F821
        back_populates="posts",
        lazy="selectin",
    )
    series: Mapped["Series | None"] = relationship(  # noqa: F821
        back_populates="posts",
        lazy="selectin",
    )
    tags: Mapped[list[Tag]] = relationship(
        secondary="post_tags",
        back_populates="posts",
        lazy="selectin",
    )
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        back_populates="post",
        lazy="noload",  # Only load when explicitly needed (post detail page)
    )

    @property
    def cover_image(self) -> str | None:
        """The post's first https image — a cover for feed cards, found not stored.

        Markdown ``![alt](url)`` or an HTML ``<img src>``, whichever comes
        first. https only: it is rendered on public pages. Read from content,
        so there is no column to keep in sync and no migration.
        """
        match = _FIRST_IMAGE.search(self.content or "")
        return match.group(1) or match.group(2) if match else None

