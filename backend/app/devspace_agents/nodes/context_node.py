"""Context node — author context enrichment and pgvector retrieval."""

import logging

from langgraph.types import RunnableConfig
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.devspace_agents.langfuse.client import langfuse
from app.devspace_agents.pipeline.state import AgentState
from app.services.embedding_service import get_embeddings
from app.services.user_context_service import get_user_context

logger = logging.getLogger(__name__)


async def context_node(state: AgentState, config: RunnableConfig) -> dict:
    db: AsyncSession = config["configurable"]["db"]
    span = langfuse.start_observation(
        trace_context={"id": state["langfuse_trace_id"]},
        name="context_node",
        as_type="span",
    )
    try:
        owner_id = state["owner_id"]

        context = await get_user_context(db, owner_id)
        if context is None:
            span.update(status_message="no_user_context")
            span.end()
            return {
                "author_context": {
                    "bio": "", "interests": [], "learning_focus": "", "lifestyle_context": "",
                    "relevant_fields": [],
                }
            }

        topic = state["topic"]
        # Ranking is enrichment, not a requirement: an embedding outage (the
        # HF free credit running out answers 402) costs the ranking, not the
        # run. The orchestrator treats its own embedding call the same way.
        try:
            vectors = await get_embeddings([topic])
        except Exception:
            logger.exception("Embedding failed in context node — continuing without ranking")
            vectors = []
        relevant_fields = []

        if vectors:
            query_vector = vectors[0]
            stmt = sql_text("""
                SELECT field_key,
                       embedding <=> CAST(:vec AS vector) AS distance
                FROM context_embeddings
                WHERE owner_id = :owner_id
                  AND embedding IS NOT NULL
                ORDER BY distance ASC
                LIMIT 3
            """)
            rows = await db.execute(
                stmt, {"vec": str(query_vector), "owner_id": str(owner_id)}
            )
            results = rows.all()

            span.create_event(
                name="context_pgvector_query",
                input={"topic": topic, "owner_id": owner_id},
                output={
                    "rows_returned": len(results),
                    "relevant_fields": [r.field_key for r in results],
                },
            )

            relevant_fields = [r.field_key for r in results]
        else:
            logger.warning("Could not embed topic for context node — skipping pgvector query")

        span.update(status_message="context_loaded")
        span.end()
        return {
            "author_context": {
                "bio": context.bio or "",
                "interests": context.interests or [],
                "learning_focus": context.learning_focus or "",
                "lifestyle_context": context.lifestyle_context or "",
                "relevant_fields": relevant_fields,
            }
        }

    except Exception as exc:
        span.update(level="ERROR", status_message=str(exc))
        span.end()
        raise RuntimeError(f"context_node failed: {exc}") from exc
