"""add site links

Revision ID: 8e4f2a6c1b90
Revises: 5d1b7c9e2a31
Create Date: 2026-09-24 22:00:00.000000

Hyperlinks between indexed pages, recorded at index time — the solid lines of
the constellation. Additive.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "8e4f2a6c1b90"
down_revision: Union[str, None] = "5d1b7c9e2a31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("from_url", sa.Text(), nullable=False),
        sa.Column("to_url", sa.Text(), nullable=False),
    )
    op.create_index("ix_site_links_from_url", "site_links", ["from_url"])
    op.create_index("ix_site_links_to_url", "site_links", ["to_url"])


def downgrade() -> None:
    op.drop_index("ix_site_links_to_url", table_name="site_links")
    op.drop_index("ix_site_links_from_url", table_name="site_links")
    op.drop_table("site_links")
