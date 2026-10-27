"""add page views

Revision ID: 9a3c5e7f1b20
Revises: 8e4f2a6c1b90
Create Date: 2026-10-27 21:00:00.000000

One row per public page load, read by the admin analytics page. Additive.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "9a3c5e7f1b20"
down_revision: Union[str, None] = "8e4f2a6c1b90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "page_views",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("referrer", sa.Text(), nullable=True),
        sa.Column("visitor", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_page_views_created_at", "page_views", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_page_views_created_at", table_name="page_views")
    op.drop_table("page_views")
