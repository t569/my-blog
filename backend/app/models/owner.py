"""Owner model — single-row table for future multi-tenant scoping."""

import uuid
from datetime import datetime

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Owner(Base):
    __tablename__ = "owners"

    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    # Feature switches the owner has turned off, as {feature_id: bool}. A
    # missing key means on, so an empty object is upstream's behaviour and no
    # existing install changes when this column appears. Credentials still
    # decide what is *possible*; this only decides what is *wanted*.
    # See app/services/feature_service.py for the registry.
    features: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    # Faces for the chat assistant and the agents, as
    # {character_id: {style, seed, image_url?}}. Empty = built-in defaults.
    # Deferred, and with no ORM-side default: it is never in an ordinary
    # SELECT or INSERT, so every other owner query keeps working on a database
    # the migration hasn't reached yet. See app/services/character_service.py.
    characters: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
        deferred=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.now,
        nullable=False,
    )
