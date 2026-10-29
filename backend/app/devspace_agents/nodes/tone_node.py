"""Tone node — writing style analysis from the published post corpus."""

import json
import logging
from datetime import datetime

from groq import AsyncGroq
from langgraph.types import RunnableConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.devspace_agents.langfuse.client import langfuse
from app.devspace_agents.llm import create_json
from app.devspace_agents.pipeline.state import AgentState
from app.models.post import Post

logger = logging.getLogger(__name__)

_TONE_SAMPLE_SIZE = 10
_TONE_FALLBACK = (
    "Write in a clear, practical, developer-focused style. "
    "Use short paragraphs and concrete examples over abstract theory. "
    "Keep a direct, confident tone."
)


async def tone_node(state: AgentState, config: RunnableConfig) -> dict:
    db: AsyncSession = config["configurable"]["db"]
    span = langfuse.start_observation(
        trace_context={"id": state["langfuse_trace_id"]},
        name="tone_node",
        as_type="span",
    )
    try:
        owner_id = state["owner_id"]

        result = await db.execute(
            select(Post)
            .where(
                Post.status == "published",
                Post.deleted_at.is_(None),
                Post.owner_id == owner_id,
            )
            .order_by(Post.published_at.desc())
            .limit(_TONE_SAMPLE_SIZE)
        )
        posts = result.scalars().all()

        if len(posts) < 3:
            logger.warning("Fewer than 3 published posts — using fallback tone profile.")
            span.update(status_message="fallback_used_corpus_too_small")
            span.end()
            return {
                "tone_profile": _TONE_FALLBACK,
                "tone_opening_pattern": "Start with a problem statement or a real situation that makes the reader feel the pain before explaining the solution.",
                "tone_humour_style": "Dry, analogy-based. Use sparingly.",
                "tone_technical_depth": "Assume developer-level baseline. Explain why, not just what. Show code where it clarifies.",
                "tone_structure_notes": "Use H2 headers. Prefer prose over lists. Keep paragraphs to 3-5 sentences.",
                "tone_avoid": [
                    "In this post, I will...",
                    "In conclusion",
                    "It's worth noting that",
                    "In the rapidly evolving landscape of",
                ],
            }

        corpus_text = "\n---\n".join(
            f"Title: {p.title}\nExcerpt: {p.excerpt or ''}\nContent start: {p.content[:500]}"
            for p in posts
        )

        system_prompt = """You are a writing style analyst. Your job is to produce a precise, \
        actionable style guide based on an author's published blog posts — one that another \
        writer (or an LLM) could follow to produce output that genuinely sounds like that person.

        DO NOT produce vague descriptors like "conversational" or "engaging". These are useless \
        to a writer. Be specific about:

        1. VOICE: Does the author write in first person? Do they address the reader directly? \
           Do they use "we" or "you"? Are they opinionated or neutral?
        2. OPENING PATTERN: How do posts start? Problem statement? Anecdote? Provocative claim? \
           Direct dive into content?
        3. HUMOUR & PERSONALITY: Where and how does humour appear? Is it dry? Self-deprecating? \
           Analogy-based? What kinds of references do they reach for?
        4. TECHNICAL DEPTH: Do they explain concepts from scratch or assume baseline knowledge? \
           Do they show code? At what level of detail?
        5. STRUCTURE: Do they use headers? How often? Do they prefer lists or prose? \
           How do paragraphs end — with a conclusion, a question, or a pivot to the next idea?
        6. WHAT TO AVOID: What patterns are absent from this author's writing that a generic \
           AI would reach for? (e.g. "never ends with 'In conclusion'", \
           "never uses bullet points to summarise what the prose already said", \
           "never uses corporate hedging language like 'it's worth noting that'")

        Return ONLY valid JSON, no markdown fences, no preamble.
        Schema:
        {
          "tone_profile": "...",
          "opening_pattern": "...",
          "humour_style": "...",
          "technical_depth": "...",
          "structure_notes": "...",
          "avoid": ["...", "..."]
        }

        Each field: 1-3 sentences. Specific. Actionable."""

        user_prompt = f"""Here are the author's recent published posts. Analyse the writing style \
        and produce a style guide.

        {corpus_text}

        Focus on patterns that appear consistently across multiple posts — these are the real \
        style signals. Ignore one-off choices."""

        groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

        generation = span.start_observation(
            name="tone_style_analysis",
            as_type="generation",
            model=settings.GROQ_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        response = await create_json(
            groq_client,
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
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
            tone_profile = parsed.get("tone_profile", _TONE_FALLBACK)
            opening_pattern = parsed.get("opening_pattern", "")
            humour_style = parsed.get("humour_style", "")
            tech_depth = parsed.get("technical_depth", "")
            structure_notes = parsed.get("structure_notes", "")
            avoid_list = parsed.get("avoid", [])
        except (json.JSONDecodeError, KeyError):
            tone_profile = _TONE_FALLBACK
            opening_pattern = ""
            humour_style = ""
            tech_depth = ""
            structure_notes = ""
            avoid_list = []

        span.update(status_message=f"analysed_{len(posts)}_posts")
        span.end()

        return {
            "tone_profile": tone_profile,
            "tone_opening_pattern": opening_pattern,
            "tone_humour_style": humour_style,
            "tone_technical_depth": tech_depth,
            "tone_structure_notes": structure_notes,
            "tone_avoid": avoid_list,
        }

    except Exception as exc:
        span.update(level="ERROR", status_message=str(exc))
        span.end()
        raise RuntimeError(f"tone_node failed: {exc}") from exc
