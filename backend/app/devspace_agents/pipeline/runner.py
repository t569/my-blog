"""Pipeline runner — entry point for executing the agent pipeline."""

import json
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import async_session_factory
from app.devspace_agents.langfuse.client import langfuse
from app.devspace_agents.pipeline import events
from app.devspace_agents.pipeline.graph import pipeline
from app.models.agent import AgentRun
from app.schemas.post import PostCreate
from app.services import post_service, tag_service
from app.services.embedding_service import generate_embeddings_background

logger = logging.getLogger(__name__)


async def run_agent_pipeline(
    owner_id: uuid.UUID,
    triggered_by: str,
    run_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Run the pipeline, recording it as ``run_id`` when the caller already
    created that row (the manual trigger does, to return its id), else a new one.

    Before ``run_id`` was accepted, a manual trigger made a row, returned its id,
    and the runner made a second row and ran under that — so the id the admin
    got back pointed at a run that never ran, stuck at "running" for ever.
    """
    if run_id is None:
        async with async_session_factory() as session:
            run = AgentRun(
                owner_id=owner_id,
                triggered_by=triggered_by,
                status="running",
                started_at=datetime.now(),
                model_used=settings.GROQ_MODEL,
            )
            session.add(run)
            await session.flush()
            run_id = run.id
            await session.commit()

    # Live progress for the admin swarm view. Edges come from the compiled
    # graph, so adding a node there needs nothing here.
    tracker = events.Tracker(run_id, [(e.source, e.target) for e in pipeline.get_graph().edges])
    tracker.start()

    root_span = langfuse.start_observation(
        trace_context={
            "id": str(run_id),
            "name": "agent_pipeline",
            "user_id": str(owner_id),
            "tags": ["agent_pipeline", triggered_by],
            "metadata": {
                "owner_id": str(owner_id),
                "triggered_by": triggered_by,
                "model": settings.GROQ_MODEL,
            },
        },
        name="agent_pipeline",
        as_type="span",
        input={"owner_id": str(owner_id), "triggered_by": triggered_by},
    )

    async with async_session_factory() as db:
        last_run = await db.execute(
            select(AgentRun)
            .where(
                AgentRun.owner_id == owner_id,
                AgentRun.status == "completed",
                AgentRun.output_post_id.isnot(None),
            )
            .order_by(AgentRun.started_at.desc())
            .limit(1)
        )
        last_run = last_run.scalar_one_or_none()
        last_generated_topic = None
        if last_run and last_run.run_log:
            last_generated_topic = last_run.run_log.get("topic")

    initial_state = {
        "owner_id": str(owner_id),
        "triggered_by": triggered_by,
        "langfuse_trace_id": str(run_id),
        "langfuse_root_span_id": root_span.id,
        "last_generated_topic": last_generated_topic,
    }

    try:
        async with async_session_factory() as session:
            # `astream` instead of `ainvoke`: the same run, but it reports each
            # node as it finishes. "values" carries the accumulated state, whose
            # last value is exactly what `ainvoke` would have returned.
            result_state: dict = {}
            async for mode, chunk in pipeline.astream(
                initial_state,
                config={"configurable": {"db": session}},
                stream_mode=["updates", "values"],
            ):
                if mode == "updates":
                    for node in chunk:
                        tracker.finished(node)
                else:
                    result_state = chunk

            resolved_tag_ids = []
            for tag_name in result_state.get("draft_tags", []):
                tag = await tag_service.get_or_create_tag(
                    session, tag_name, owner_id
                )
                resolved_tag_ids.append(tag.id)

            post_data = PostCreate(
                title=result_state["draft_title"],
                content=result_state["draft_content"],
                category_id=uuid.UUID(result_state["draft_category_id"]),
                tags=[str(tid) for tid in resolved_tag_ids],
                status="draft",
                is_agent_authored=True,
            )
            post = await post_service.create_post(session, post_data, owner_id)
            await session.commit()

        await generate_embeddings_background(post.id)

        run_log = {
            "topic": result_state.get("topic"),
            "topic_rationale": result_state.get("topic_rationale"),
            "research_summary": result_state.get("research_summary"),
            "tone_profile": result_state.get("tone_profile"),
            "sources": [
                r["url"] for r in result_state.get("research_results", [])
            ],
            "langfuse_trace_url": f"{settings.LANGFUSE_HOST}/trace/{run_id}",
        }

        async with async_session_factory() as session:
            await _update_agent_run(
                session, run_id,
                status="completed",
                output_post_id=post.id,
                run_log=run_log,
            )
            await session.commit()
        tracker.complete()

        root_span.update(
            output={
                "topic": result_state.get("topic"),
                "post_id": str(post.id),
                "status": "completed",
            },
        )

    except Exception as exc:
        logger.exception("Agent pipeline failed for run %s", run_id)
        tracker.failed()
        async with async_session_factory() as session:
            await _update_agent_run(
                session, run_id,
                status="failed",
                run_log={"error": str(exc)},
            )
            await session.commit()

        root_span.update(
            output={"status": "failed", "error": str(exc)},
            level="ERROR",
        )

    finally:
        root_span.end()
        langfuse.flush()

    return run_id


async def _update_agent_run(
    db: AsyncSession,
    run_id: uuid.UUID,
    *,
    status: str,
    output_post_id: uuid.UUID | None = None,
    run_log: dict | None = None,
) -> None:
    from sqlalchemy import select

    result = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        return

    run.status = status
    run.completed_at = datetime.now()
    if output_post_id is not None:
        run.output_post_id = output_post_id
    if run_log is not None:
        run.run_log = run_log
    await db.flush()
