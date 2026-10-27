"""PageView model — one row per public page load, for the admin analytics page."""

from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PageView(Base):
    __tablename__ = "page_views"

    path: Mapped[str] = mapped_column(Text, nullable=False)
    # Host only ("news.ycombinator.com"); null is a direct visit.
    referrer: Mapped[str | None] = mapped_column(Text, nullable=True)
    # hash(secret, UTC day, IP, user agent) — counts a visitor for one day
    # without storing who they are. See routers/analytics.py.
    visitor: Mapped[str] = mapped_column(Text, nullable=False)
    # Stamped by the database, so rows from Render (UTC) and a local backend
    # (local time) agree.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
