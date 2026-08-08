"""Orchestrator node — topic selection and pipeline initialization."""

import json
import logging
from datetime import datetime

from groq import AsyncGroq
from langgraph.types import RunnableConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.devspace_agents.langfuse.client import langfuse
from app.devspace_agents.pipeline.state import AgentState
from app.models.post import Post
from app.services.user_context_service import get_user_context
from app.services.embedding_service import get_embeddings

logger = logging.getLogger(__name__)


async def orchestrator_node(state: AgentState, config: RunnableConfig) -> dict:
    db: AsyncSession = config["configurable"]["db"]
    span = langfuse.start_observation(
        trace_context={"id": state["langfuse_trace_id"]},
        name="orchestrator_node",
        as_type="span",
    )
    try:
        owner_id = state["owner_id"]

        context = await get_user_context(db, owner_id)
        if context is None:
            author_context = {"bio": "", "interests": [], "learning_focus": "", "lifestyle_context": ""}
        else:
            author_context = {
                "bio": context.bio or "",
                "interests": context.interests or [],
                "learning_focus": context.learning_focus or "",
                "lifestyle_context": context.lifestyle_context or "",
            }

        result = await db.execute(
            select(Post)
            .where(
                Post.status == "published",
                Post.deleted_at.is_(None),
                Post.owner_id == owner_id,
            )
            .order_by(Post.published_at.desc())
            .limit(10)
        )
        recent_posts = result.scalars().all()
        recent_post_titles = [p.title for p in recent_posts]

        interests_query = ", ".join(author_context["interests"])
        query_text = interests_query or author_context["learning_focus"] or "technology"
        try:
            vectors = await get_embeddings([query_text])
            if vectors:
                from sqlalchemy import text as sql_text
                from app.models.agent import PostEmbedding

                vec = vectors[0]
                sim_stmt = sql_text("""
                    SELECT DISTINCT ON (pe.post_id)
                        pe.post_id,
                        p.title, p.slug, p.excerpt,
                        1 - (pe.embedding <=> CAST(:vec AS vector)) AS similarity
                    FROM post_embeddings pe
                    JOIN posts p ON pe.post_id = p.id
                    WHERE p.owner_id = :owner_id
                      AND p.status = 'published'
                      AND p.deleted_at IS NULL
                      AND pe.embedding IS NOT NULL
                    ORDER BY pe.post_id, similarity DESC
                    LIMIT 5
                """)
                sim_rows = await db.execute(
                    sim_stmt, {"vec": str(vec), "owner_id": str(owner_id)}
                )
                relevant_past_posts = [
                    {
                        "title": r.title,
                        "slug": r.slug,
                        "excerpt": r.excerpt or "",
                        "similarity": round(float(r.similarity), 4),
                    }
                    for r in sim_rows
                ]
            else:
                relevant_past_posts = []
        except Exception:
            logger.exception("Semantic search failed in orchestrator — continuing without past posts")
            relevant_past_posts = []

        # ── DOMAIN ROTATION LOGIC ──────────────────────────────────────────────────
        # Count how many of the last 5 posts fall into each broad domain.
        # The orchestrator prompt uses this to nudge away from clusters.
        domain_map = {
            "ai_ml": ["AI", "ML", "LLM", "RAG", "agent", "embedding", "model",
                      "LangChain", "LangGraph", "Hugging Face", "fine-tun"],
            "backend": ["backend", "API", "database", "postgres", "FastAPI",
                        "system design", "architecture", "queue", "cache"],
            "systems": ["Rust", "Go", "low-level", "memory", "concurrency",
                        "embedded", "robotics", "performance"],
            "career": ["career", "learning", "open source", "junior", "engineer",
                       "productivity", "growth", "reflection"],
            "projects": ["built", "project", "ship", "launched", "weekend",
                         "side project"],
        }

        domain_counts = {domain: 0 for domain in domain_map}
        for post_title in recent_post_titles:
            title_lower = post_title.lower()
            for domain, keywords in domain_map.items():
                if any(kw.lower() in title_lower for kw in keywords):
                    domain_counts[domain] += 1
                    break

        # Build a rotation hint: underrepresented domains get surfaced to the LLM
        saturated = [d for d, count in domain_counts.items() if count >= 2]
        underrepresented = [d for d, count in domain_counts.items() if count == 0]
        rotation_hint = ""
        if saturated:
            rotation_hint += f"Domains that appear clustered in recent posts (avoid if possible): {', '.join(saturated)}. "
        if underrepresented:
            rotation_hint += f"Domains not recently covered (prefer these): {', '.join(underrepresented)}."

        relevant_posts_text = "\n".join(
            f"  - {p['title']} (similarity: {p['similarity']})"
            for p in relevant_past_posts
        ) or "  (none yet)"

        last_topic_block = ""
        if state.get("last_generated_topic"):
            last_topic_block = (
                f"\nThe PREVIOUS agent-generated post was about: \"{state['last_generated_topic']}\". "
                f"This topic is completely off-limits. Selecting the same topic or any semantically "
                f"adjacent topic is a failure.\n"
            )

        # Split rather than made an f-string: the prompt below contains a
        # literal JSON schema, whose braces an f-string would try to interpolate.
        system_prompt = (
            f"You are a topic selection assistant for a developer blog run by "
            f"{settings.AUTHOR_PERSONA}. "
            """Your job is to select a specific, non-generic blog topic that reflects what the author is \
        actively learning or building, avoids repeating recently covered ground, and serves a general \
        tech audience of peers, potential employers, and junior developers.

        RULES:
        1. The topic must be concrete and specific. A topic is specific enough when it could not be the \
        title of a Wikipedia article. It must name a particular problem, trade-off, decision, failure \
        mode, or technique — not a domain or technology. If the topic sounds like a chapter heading in \
        a textbook, it is too broad. If it sounds like something the author discovered while actually \
        building something, it is specific enough.
        2. The topic must connect to the author's current learning focus or interests — do not invent \
        topics that have no relationship to the provided context.
        3. Prefer topics that sit at the intersection of two domains (e.g. systems thinking + AI, \
        backend engineering + observability, Rust + ML tooling) — these produce more original content \
        than single-domain posts.
        4. Avoid topics where a five-minute Google search returns fifty identical blog posts. \
        The author's angle, lived experience, or specific tech stack must be the differentiator.
        5. DOMAIN ROTATION IS MANDATORY, NOT OPTIONAL. If the rotation guidance below marks a domain \
        as saturated, you must not select a topic from that domain regardless of how relevant it seems. \
        A saturated domain means the author's readers have seen enough of that recently. Choose from \
        underrepresented domains first. If no domain is underrepresented, pick any non-saturated domain.
        6. Respect the "avoid repetition" list. Semantically similar topics count as repetition.

        Return ONLY valid JSON. No markdown fences. No preamble. No explanation.
        Schema: {"topic": "...", "rationale": "..."}

        The "rationale" must explain: (a) why this topic now given the author's current focus, \
        (b) what makes it non-generic, and (c) which audience segment it most benefits."""
        )

        user_prompt = f"""MANDATORY DOMAIN ROTATION CONSTRAINT:
        {rotation_hint or 'No clustering detected — all domains available.'}
        {last_topic_block}
        
        Author bio: {author_context['bio']}

        Active interests: {', '.join(author_context['interests'])}

        Current learning focus: {author_context['learning_focus']}

        Personal/lifestyle context: {author_context['lifestyle_context']}

        Recent published posts (avoid these topics — semantically, not just literally):
        {chr(10).join('  - ' + t for t in recent_post_titles) or '  (none yet)'}

        Semantically similar past posts (via vector search — these topics are also off-limits):
        {relevant_posts_text}

        Domain rotation guidance: {rotation_hint or 'No strong clustering detected — pick freely.'}

        Select one specific, focused topic. It should be something the author could credibly write \
        about from direct experience or active study — not a survey of the whole field."""

        groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

        generation = span.start_observation(
            name="orchestrator_topic_selection",
            as_type="generation",
            model=settings.GROQ_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        response = await groq_client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        response_text = response.choices[0].message.content or ""
        generation.update(
            output=response_text,
            usage_details={
                "input": response.usage.prompt_tokens if response.usage else 0,
                "output": response.usage.completion_tokens if response.usage else 0,
            },
        )
        generation.end()

        try:
            parsed = json.loads(response_text)
            topic = parsed["topic"]
            rationale = parsed["rationale"]
        except (json.JSONDecodeError, KeyError):
            retry_generation = span.start_observation(
                name="orchestrator_topic_selection_retry",
                as_type="generation",
                model=settings.GROQ_MODEL,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": response_text},
                    {"role": "user",
                     "content": "Your previous response was not valid JSON. Reply with ONLY: {\"topic\": \"...\", \"rationale\": \"...\"}"},
                ],
            )
            retry_response = await groq_client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": response_text},
                    {"role": "user", "content": "Your previous response was not valid JSON. Reply with ONLY: {\"topic\": \"...\", \"rationale\": \"...\"}"},
                ],
                response_format={"type": "json_object"},
            )
            retry_text = retry_response.choices[0].message.content or ""
            retry_generation.update(
                output=retry_text,
                usage_details={
                    "input": retry_response.usage.prompt_tokens if retry_response.usage else 0,
                    "output": retry_response.usage.completion_tokens if retry_response.usage else 0,
                },
            )
            retry_generation.end()
            parsed = json.loads(retry_text)
            topic = parsed["topic"]
            rationale = parsed["rationale"]

        span.update(status_message="topic_selected")
        span.end()
        return {
            "topic": topic,
            "topic_rationale": rationale,
            "author_context": author_context,
            "relevant_past_posts": relevant_past_posts,
        }

    except Exception as exc:
        span.update(level="ERROR", status_message=str(exc))
        span.end()
        raise RuntimeError(f"orchestrator_node failed: {exc}") from exc
