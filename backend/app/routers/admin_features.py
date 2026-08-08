"""Admin feature toggle endpoints — authentication required."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.db.base import get_db
from app.models.owner import Owner
from app.schemas.feature import FeatureState, FeatureUpdate
from app.services import agent_run_service, feature_service
from app.devspace_agents.scheduler import reschedule as scheduler_reschedule

router = APIRouter(
    prefix="/admin/features",
    tags=["Features (Admin)"],
    dependencies=[Depends(get_current_admin)],
)


def _to_schema(view: feature_service.FeatureView) -> FeatureState:
    return FeatureState(
        id=view.feature.id,
        label=view.feature.label,
        description=view.feature.description,
        covers=list(view.feature.covers),
        fallback=view.feature.fallback,
        available=view.available,
        enabled=view.enabled,
        missing=view.missing,
    )


@router.get("", response_model=list[FeatureState])
async def list_features(db: Annotated[AsyncSession, Depends(get_db)]):
    return [_to_schema(v) for v in await feature_service.list_features(db)]


@router.put("", response_model=list[FeatureState])
async def update_features(
    data: FeatureUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    views = await feature_service.set_features(db, data.features)

    # Switching the agent off must also stop its scheduled job — otherwise the
    # switch reads as off while the cron keeps firing until the next restart.
    # Switching it back on re-arms from the saved schedule, so the two never
    # disagree. This is the "features that need each other are one switch"
    # rule holding at runtime, not just in the UI.
    if "agent" in data.features:
        schedule = await agent_run_service.get_agent_schedule(db, admin.id)
        if schedule is not None:
            await scheduler_reschedule(
                schedule.owner_id,
                schedule.cron_expr,
                schedule.is_active and data.features["agent"],
            )

    return [_to_schema(v) for v in views]
