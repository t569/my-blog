"""SiteChunk — one searchable passage of the public site.

The posts-only index (post_embeddings) serves the search bar and stays as it
is. This one covers everything a reader can reach — posts, but also static
pages like a notes collection or a lab — split along headings into passages
small enough for the embedding model to read whole, each with a link to the
exact section. The chat assistant searches it; the constellation draws it.
"""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SiteChunk(Base):
    __tablename__ = "site_chunks"

    #: The page's path: "/posts/slug", "/notes/vol2-sieve-theory.html", "/lab".
    page_url: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    #: The passage's own link: the page path plus its heading anchor, if any.
    url: Mapped[str] = mapped_column(Text, nullable=False)
    #: post | note | lab | series | page — what kind of place this is.
    kind: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    heading: Mapped[str] = mapped_column(Text, nullable=False, default="")
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(384), nullable=True)
    #: Hash of the whole page's text when indexed; unchanged pages are skipped.
    page_hash: Mapped[str] = mapped_column(Text, nullable=False)
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
    )
    indexed_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)
