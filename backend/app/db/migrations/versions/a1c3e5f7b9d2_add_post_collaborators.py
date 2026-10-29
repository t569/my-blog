"""add collaborators to posts

Revision ID: a1c3e5f7b9d2
Revises: e7f8a9b0c1d2
Create Date: 2026-10-29 12:00:00.000000

Names credited on a post, e.g. readers whose preview-link suggestions were
used. A text array with an empty default, so existing rows need no backfill.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1c3e5f7b9d2"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column(
            "collaborators",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("posts", "collaborators")
