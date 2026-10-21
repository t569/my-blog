"""Admin context management endpoints — authentication required."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.db.base import get_db
from app.models.owner import Owner
from app.schemas.user_context import UserContextResponse, UserContextUpdate
from app.services import user_context_service
from app.services.context_embedding_service import generate_context_embeddings_background

router = APIRouter(
    prefix="/admin/context",
    tags=["Context (Admin)"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("", response_model=UserContextResponse)
async def get_context(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    """Retrieve the current owner's context.

    If the context has not been created yet, a default empty context is returned
    so the client form has structured fields to bind to.
    """
    context = await user_context_service.get_user_context(db, admin.id)
    if context is None:
        # Return a mock schema so the frontend gets consistent data structure
        # (This is not saved to the DB until a PUT request is made)
        return {
            "id": "00000000-0000-0000-0000-000000000000",
            "owner_id": admin.id,
            "bio": "",
            "interests": [],
            "learning_focus": "",
            "lifestyle_context": "",
            "updated_at": "1970-01-01T00:00:00Z",
        }
    return context


@router.put("", response_model=UserContextResponse, status_code=status.HTTP_200_OK)
async def update_context(
    data: UserContextUpdate,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[Owner, Depends(get_current_admin)],
):
    """Create or update the owner's context.

    Follows an upsert pattern: creates the row if it doesn't exist, updates if it does.
    After saving, triggers background context embedding generation.
    """
    context = await user_context_service.upsert_user_context(db, admin.id, data)
    # Committed before the task, not by get_db — see admin_posts.create_post.
    await db.commit()

    background_tasks.add_task(
        generate_context_embeddings_background,
        context.owner_id,
    )

    await db.refresh(context)
    return context
