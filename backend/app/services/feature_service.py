"""Feature registry — what the deployment *can* do, and what it's told to do.

Two independent things decide whether a feature runs:

    available — its credentials are set. Environment, not editable at runtime.
    enabled   — the owner's switch on the admin Features page. Database.

A feature runs only when both hold. Credentials are what makes a feature
possible; the switch is what makes it wanted. Neither can substitute for the
other, which is why a missing credential shows as "unavailable" rather than as
an off switch the owner can't turn on.

Features that need each other are one entry here, not several. The agent's
schedule, its manual trigger and its draft generation all die with the LLM key,
so they are one switch called "agent" — a UI that offered three would let you
build states the backend cannot honour.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, settings
from app.db.base import async_session_factory
from app.models.owner import Owner

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Feature:
    id: str
    label: str
    description: str
    #: What stops working when this is off, shown under the switch. These are
    #: the parts that cannot be switched separately — see the module docstring.
    covers: tuple[str, ...]
    #: Environment variables that must all be non-empty for it to be available.
    requires: tuple[str, ...]
    #: Message returned by ``require()`` when the feature is off or missing.
    unavailable_detail: str
    #: Extra env condition beyond the credentials (the agent's master switch).
    switch: str | None = None
    #: What still works with it off, shown as reassurance in the UI.
    fallback: str = ""
    #: State when the owner has never touched the switch. Defaults to on, which
    #: is what keeps a fork's behaviour unchanged when a feature is added to
    #: this registry. Set it off for anything the owner should opt into.
    default_enabled: bool = True


REGISTRY: tuple[Feature, ...] = (
    Feature(
        id="agent",
        label="AI writing agent",
        description=(
            "Generates post drafts from your context profile — on a schedule "
            "or on demand. Drafts are always saved for review; nothing "
            "publishes itself."
        ),
        covers=(
            "Scheduled runs",
            "Run agent now",
            "Draft generation",
            "Topic research",
        ),
        requires=("GROQ_API_KEY",),
        switch="AGENT_ENABLED",
        unavailable_detail="The AI writing agent is turned off.",
        fallback="Existing drafts stay editable.",
    ),
    Feature(
        id="uploads",
        label="Image uploads",
        description=(
            "Uploads images in the editor to Cloudinary and deletes them "
            "again. All three Cloudinary values are needed — a partial set is "
            "not configuration."
        ),
        covers=("Editor image upload", "Image delete"),
        requires=(
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
        ),
        unavailable_detail="Image uploads are turned off.",
        fallback="Images already uploaded keep working — they are CDN URLs.",
    ),
    Feature(
        id="semantic_search",
        label="Semantic search",
        description=(
            "Adds meaning-based matches to search by embedding the query, on "
            "top of the keyword results. Worth its keep at hundreds of posts, "
            "not at a dozen."
        ),
        covers=("Embedding search results", "Embedding backfill"),
        requires=("HUGGINGFACE_TOKEN",),
        unavailable_detail="Semantic search is turned off.",
        fallback="Search still runs full-text keyword matching.",
    ),
    Feature(
        id="display_math",
        label="Display math in the editor",
        description=(
            "Lets the rich editor hold centred LaTeX equations — $$…$$ on "
            "their own lines, or a ```math fence — instead of sending the "
            "whole post to the markdown textarea. Published pages render "
            "these either way; this is about how you edit them."
        ),
        covers=(
            "Display equations in the rich editor",
            "The /display math command",
        ),
        # No credentials: nothing external is called, so this is always
        # available and the switch is purely the owner's choice. It is also the
        # one entry here the backend never enforces — an authoring preference,
        # not a deployment capability, so there is no require() call for it.
        requires=(),
        default_enabled=False,
        unavailable_detail="Display math editing is turned off.",
        fallback=(
            "Posts with display math still open in the markdown editor, and "
            "still render on the site."
        ),
    ),
)

BY_ID: dict[str, Feature] = {f.id: f for f in REGISTRY}


def is_available(feature: Feature, cfg: Settings | None = None) -> bool:
    """Whether credentials (and any master env switch) allow this at all."""
    cfg = cfg or settings
    if feature.switch and not getattr(cfg, feature.switch):
        return False
    return all(bool(getattr(cfg, name, "")) for name in feature.requires)


def is_effective(feature: Feature, flags: dict, cfg: Settings | None = None) -> bool:
    """The one rule: available AND not switched off.

    A feature the owner has never touched falls back to its own
    ``default_enabled``, which is on for everything that predates that field —
    so adding it changed no existing behaviour.
    """
    return is_available(feature, cfg) and bool(
        flags.get(feature.id, feature.default_enabled)
    )


@dataclass
class FeatureView:
    """A registry entry resolved against this deployment. What the API returns."""

    feature: Feature
    available: bool
    enabled: bool
    missing: list[str] = field(default_factory=list)


async def _load_flags(db: AsyncSession) -> tuple[uuid.UUID | None, dict]:
    """The owner row's switches. Single-owner blog — first row wins."""
    owner = (await db.execute(select(Owner).limit(1))).scalar_one_or_none()
    if owner is None:
        return None, {}
    return owner.id, dict(owner.features or {})


def missing_for(feature: Feature, cfg: Settings | None = None) -> list[str]:
    """What the environment still owes this feature, named as the UI shows it.

    A master switch turned off is listed the same way a missing key is: both
    are things only a deploy can change, and the page's job is to say which.
    """
    cfg = cfg or settings
    missing = [name for name in feature.requires if not getattr(cfg, name, "")]
    if feature.switch and not getattr(cfg, feature.switch):
        missing.append(f"{feature.switch}=true")
    return missing


async def list_features(db: AsyncSession) -> list[FeatureView]:
    _, flags = await _load_flags(db)
    return [
        FeatureView(
            feature=f,
            available=is_available(f),
            # Report the switch itself, not the resolved state: an unavailable
            # feature should not read as "off by choice" once credentials land.
            enabled=bool(flags.get(f.id, f.default_enabled)),
            missing=missing_for(f),
        )
        for f in REGISTRY
    ]


async def set_features(db: AsyncSession, updates: dict[str, bool]) -> list[FeatureView]:
    """Apply a partial {id: bool} update. Unknown ids are rejected."""
    unknown = sorted(set(updates) - set(BY_ID))
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown feature(s): {', '.join(unknown)}",
        )

    owner = (await db.execute(select(Owner).limit(1))).scalar_one_or_none()
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No owner row. Run scripts/seed_owner.py.",
        )

    # Replace the dict rather than mutating it — SQLAlchemy does not track
    # in-place changes to a JSONB value, so a mutated dict never gets written.
    owner.features = {**(owner.features or {}), **updates}
    await db.commit()

    return await list_features(db)


async def enabled(feature_id: str) -> bool:
    """Whether a feature may run right now, from anywhere.

    ponytail: one SELECT per guarded call, no cache. The guarded paths are an
    agent run, an image upload and a search — none of them hot, and a cache
    would go stale across workers the moment the owner flips a switch. Cache
    when a profiler says the read costs something.
    """
    feature = BY_ID[feature_id]
    if not is_available(feature):
        return False
    async with async_session_factory() as session:
        _, flags = await _load_flags(session)
    return is_effective(feature, flags)


async def require(feature_id: str) -> None:
    """503 unless the feature may run. Mirrors the credential guards."""
    if not await enabled(feature_id):
        feature = BY_ID[feature_id]
        missing = missing_for(feature)
        detail = feature.unavailable_detail
        if missing:
            detail = f"{feature.label} is not configured — needs {', '.join(missing)}."
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )
