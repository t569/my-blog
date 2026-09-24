"""add owner characters

Revision ID: 0c7a5e1d9b42
Revises: f1a2b3c4d5e6
Create Date: 2026-09-24 15:00:00.000000

Adds owners.characters — {character_id: {style, seed, image_url?}} for the
faces of the chat assistant and the agents, chosen on the admin Characters
page. The default '{}' means "built-in faces", so an install that never opens
that page looks exactly as it did.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "0c7a5e1d9b42"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "owners",
        sa.Column(
            "characters",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("owners", "characters")
