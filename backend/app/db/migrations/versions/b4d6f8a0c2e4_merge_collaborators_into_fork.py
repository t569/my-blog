"""merge the collaborators migration into the fork's chain

Revision ID: b4d6f8a0c2e4
Revises: 9a3c5e7f1b20, a1c3e5f7b9d2
Create Date: 2026-10-29 12:30:00.000000

Collaborators was written against upstream's head (e7f8a9b0c1d2) so it can go
upstream as-is; this fork's own migrations branch from the same point. Joining
the two keeps a single head, which `alembic upgrade head` at boot requires.
No schema change of its own.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "b4d6f8a0c2e4"
down_revision: Union[str, Sequence[str], None] = ("9a3c5e7f1b20", "a1c3e5f7b9d2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
