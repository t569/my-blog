"""add site chunks

Revision ID: 5d1b7c9e2a31
Revises: 0c7a5e1d9b42
Create Date: 2026-09-24 21:00:00.000000

A second, site-wide search index beside post_embeddings (which the search bar
keeps using, unchanged): every page a reader can reach, split along headings
into passages, each embedded for the chat assistant and the constellation.
Additive — nothing existing is altered.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import UUID

revision: str = "5d1b7c9e2a31"
down_revision: Union[str, None] = "0c7a5e1d9b42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "site_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("page_url", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("heading", sa.Text(), nullable=False, server_default=""),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.Column("page_hash", sa.Text(), nullable=False),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("indexed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_site_chunks_page_url", "site_chunks", ["page_url"])
    op.create_index("ix_site_chunks_kind", "site_chunks", ["kind"])
    # HNSW over cosine distance, as for post_embeddings: approximate nearest
    # neighbours inside Postgres, so search stays one query however big this gets.
    op.create_index(
        "ix_site_chunks_embedding_hnsw",
        "site_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_site_chunks_embedding_hnsw", table_name="site_chunks")
    op.drop_index("ix_site_chunks_kind", table_name="site_chunks")
    op.drop_index("ix_site_chunks_page_url", table_name="site_chunks")
    op.drop_table("site_chunks")
