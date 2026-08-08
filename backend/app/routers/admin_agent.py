"""Admin agent endpoints — authentication required."""

import math
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.config import settings
from app.db.base import get_db
from app.devspace_agents.pipeline.runner import run_agent_pipeline
from app.devspace_agents.scheduler import reschedule as scheduler_reschedule
from app.models.agent import AgentRun
from app.models.owner import Owner
from app.schemas.agent import (
    AgentRunListItem,
    AgentRunResponse,
    AgentScheduleResponse,
    AgentScheduleUpdate,
    AgentTriggerResponse,
)
from app.schemas.common import PaginatedResponse
from app.services import agent_run_service, feature_service

router = APIRouter(
    prefix="/admin/agent",
    tags=["Agent (Admin)"],
    dependencies=[Depends(get_current_admin)],
)


@router.post(
    "/trigger",
    response_model=AgentTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_pipeline(
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    # Checked before the run row is written, so a disabled agent doesn't leave
    # a row stuck in "running" — the background task can't report failure.
    await feature_service.require("agent")

    run = AgentRun(
        owner_id=admin.id,
        triggered_by="manual",
        status="running",
        started_at=datetime.now(),
        model_used="llama-3.3-70b-versatile",
    )
    db.add(run)
    await db.flush()
    run_id = run.id
    await db.commit()

    background_tasks.add_task(
        run_agent_pipeline,
        owner_id=admin.id,
        triggered_by="manual",
    )

    return AgentTriggerResponse(run_id=run_id)


@router.get("/runs", response_model=PaginatedResponse[AgentRunListItem])
async def list_runs(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    runs, total = await agent_run_service.list_agent_runs(
        db, admin.id, page=page, limit=limit
    )
    return PaginatedResponse(
        items=runs,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 0,
    )


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_run(
    run_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    run = await agent_run_service.get_agent_run(db, run_id, admin.id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent run not found.",
        )
    return run


@router.get("/schedule", response_model=AgentScheduleResponse)
async def get_schedule(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    schedule = await agent_run_service.get_agent_schedule(db, admin.id)
    if schedule is None:
        return AgentScheduleResponse(
            id=uuid.uuid4(),
            owner_id=admin.id,
            cron_expr="0 9 * * 1",
            is_active=False,
            updated_at=datetime.now(),
        )
    return schedule


@router.put("/schedule", response_model=AgentScheduleResponse)
async def update_schedule(
    data: AgentScheduleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    schedule = await agent_run_service.upsert_agent_schedule(db, admin.id, data)
    await db.commit()

    await scheduler_reschedule(admin.id, data.cron_expr, data.is_active)

    return schedule
