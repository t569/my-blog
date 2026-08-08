"""Writer node — draft post generation."""

import json
import logging
import uuid

from groq import AsyncGroq
from langgraph.types import RunnableConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.devspace_agents.langfuse.client import langfuse
from app.devspace_agents.pipeline.state import AgentState
from app.models.category import Category

logger = logging.getLogger(__name__)


async def writer_node(state: AgentState, config: RunnableConfig) -> dict:
    db: AsyncSession = config["configurable"]["db"]
    span = langfuse.start_observation(
        trace_context={"id": state["langfuse_trace_id"]},
        name="writer_node",
        as_type="span",
    )
    try:
        owner_id = state["owner_id"]

        result = await db.execute(
            select(Category).where(Category.owner_id == owner_id)
        )
        categories = result.scalars().all()
        category_list = [{"id": str(c.id), "name": c.name} for c in categories]

        span.create_event(
            name="writer_category_fetch",
            output={"categories": [c.name for c in categories]},
        )

        tone = state.get("tone_profile", _TONE_FALLBACK)
        author = state.get("author_context", {})
        research = state.get("research_summary", "")
        past_posts = state.get("relevant_past_posts", [])

        category_hint = ""
        if category_list:
            category_hint = "\n".join(
                f'  - {c["name"]} (id: {c["id"]})' for c in category_list
            )

        past_titles = "\n".join(
            f'  - {p.get("title", "")}' for p in past_posts
        )

        # Assemble writer context
        tone = state.get("tone_profile", _TONE_FALLBACK)
        opening_pattern = state.get("tone_opening_pattern", "")
        humour_style = state.get("tone_humour_style", "")
        tech_depth = state.get("tone_technical_depth", "")
        structure_notes = state.get("tone_structure_notes", "")
        avoid_list = state.get("tone_avoid", [])
        author = state.get("author_context", {})
        research = state.get("research_summary", "")
        key_concepts = state.get("research_key_concepts", [])
        angles = state.get("research_angles", [])
        notable_sources = state.get("research_notable_sources", [])
        past_posts = state.get("relevant_past_posts", [])
        topic = state.get("topic", "")
        relevant_fields = author.get("relevant_fields", [])

        # Build context strings
        past_titles_text = "\n".join(f"  - {p.get('title', '')}" for p in past_posts) or "  (none yet)"
        avoid_text = "\n".join(f"  - {a}" for a in avoid_list) or "  (none specified)"
        concepts_text = ", ".join(key_concepts) or "(none provided)"
        angles_text = "\n".join(f"  - {a}" for a in angles) or "  (none provided)"
        sources_text = "\n".join(
            f"  - {s.get('title', '')} ({s.get('url', '')}): {s.get('why_relevant', '')}"
            for s in notable_sources
        ) or "  (none provided)"

        # Emphasise the context fields most relevant to this topic
        relevant_context_block = ""
        if "bio" in relevant_fields:
            relevant_context_block += f"Author background (emphasise this): {author.get('bio', '')}\n"
        if "learning_focus" in relevant_fields:
            relevant_context_block += f"Current learning (weave this in): {author.get('learning_focus', '')}\n"
        if "lifestyle_context" in relevant_fields:
            relevant_context_block += f"Personality/cultural context (use for voice and analogies): {author.get('lifestyle_context', '')}\n"
        if not relevant_context_block:
            relevant_context_block = (
                f"Bio: {author.get('bio', '')}\n"
                f"Learning focus: {author.get('learning_focus', '')}\n"
                f"Personality: {author.get('lifestyle_context', '')}\n"
            )

        system_prompt = f"""You are ghostwriting a technical blog post for {settings.AUTHOR_PERSONA}. \
        You are not writing a generic tutorial. You are writing in the author's voice, from \
        their perspective, drawing on their specific background and what they are actively learning.

        ═══════════════════════════════════════════
        VOICE & STYLE (inferred from published posts)
        ═══════════════════════════════════════════
        {tone}

        Opening pattern: {opening_pattern or 'Start with a problem statement or a real situation that makes the reader feel the pain before you explain the solution.'}

        Humour style: {humour_style or 'Dry, analogy-based. Use it sparingly — one good joke lands better than five mediocre ones. Reach for football, gaming, or cultural references when they genuinely fit.'}

        Technical depth: {tech_depth or 'Assume the reader is a developer but not necessarily an expert in this specific area. Explain the why, not just the what. Show code where it makes things clearer, not just to have code.'}

        Structure: {structure_notes or 'Use headers to break up sections. Prefer prose over bullet lists. Keep paragraphs to 3-5 sentences. End sections with a forward push to the next idea, not a summary of what you just said.'}

        ═══════════════════════════════════════════
        THINGS TO NEVER DO IN THIS POST
        ═══════════════════════════════════════════
        {avoid_text}
        - Never open with "In this post, I will..."
        - Never use "In conclusion" or "To summarise" as a section header or opener
        - Never end with a generic call to action like "Let me know your thoughts in the comments"
        - Never use consecutive bullet lists as a substitute for explanation
        - Never hedge with "it's worth noting that" or "it's important to mention"
        - Never write a post that could have been written by someone with no hands-on experience
        - Never sound like ChatGPT wrote it — no "In the rapidly evolving landscape of..."

        ═══════════════════════════════════════════
        AUTHOR CONTEXT
        ═══════════════════════════════════════════
        {relevant_context_block}
        Full interests: {', '.join(author.get('interests', []))}

        Use this context to:
        - Ground examples in the author's actual stack (Python, FastAPI, LangGraph, pgvector, etc.)
        - Reference the author's background where it adds authenticity (mechatronics → systems thinking)
        - Use analogies from the author's world (Liverpool FC, EA FC, psychology, kinesics) when they \
          genuinely clarify a technical point — never force them

        ═══════════════════════════════════════════
        AVAILABLE CATEGORIES (select exactly one)
        ═══════════════════════════════════════════
        {category_hint}
        
        ═══════════════════════════════════════════
        MANDATORY POST STRUCTURE
        ═══════════════════════════════════════════
        The post MUST follow this structure. Deviation is not permitted.
        
        OPENING (no header — just prose):
          Do not open with a definition, a broad statement about the technology, or
          "In this post I will...". Open by dropping the reader into a specific
          situation, problem, or observation. The first sentence should make the
          reader feel something — curiosity, recognition, or mild discomfort.
          The opening section should be 2-4 paragraphs of prose with no header.
        
        BODY (2-4 major sections with ## headers):
          Each section must advance an argument or build toward a conclusion.
          Sections that merely explain a concept without connecting it to the
          post's central point are filler — remove them.
          Use ### only for distinct sub-points within a section, not for decoration.
          Code blocks: use when they make an abstract point concrete. A code block
          that could be found verbatim in any tutorial adds nothing — write
          illustrative examples that are specific to the post's argument.
        
        CLOSING (no header called "Conclusion" or "Summary"):
          End with a section that has a substantive title (e.g. "## What This
          Actually Changes" or "## Where I'm Taking This Next").
          The closing must contain a genuine takeaway — something the reader can
          do, think about, or look at differently. It must not summarise what
          the post already said. It must not end with "let me know your thoughts"
          or any variant.
        
        FORBIDDEN SECTION HEADERS:
          "Introduction", "Conclusion", "Summary", "Further Reading",
          "Key Takeaways", "In Summary", "Wrapping Up", "Final Thoughts".
          
        ═══════════════════════════════════════════
        SELF-CHECK BEFORE GENERATING OUTPUT
        ═══════════════════════════════════════════
        Before writing the post, answer these internally:
        - Does the opening start with a definition or broad statement? If yes, rewrite it.
        - Does any section header say "Introduction", "Conclusion", or "Summary"? If yes, rename it.
        - Does the post end with a call to action or a summary? If yes, replace it.
        - Is the topic the same as or semantically adjacent to any post in the recent posts list?
          If yes, stop and pick a different angle.
        - Would this post be indistinguishable from a post written by someone with no hands-on
          experience with the author's specific stack? If yes, add a concrete example from
          the author's actual work.

        ═══════════════════════════════════════════
        OUTPUT FORMAT
        ═══════════════════════════════════════════
        Return ONLY valid JSON. No markdown fences. No preamble. No explanation outside the JSON.

        {{
          "title": "...",
          "content": "... full markdown post ...",
          "tags": ["tag1", "tag2", "tag3"],
          "category_id": "uuid-string"
        }}

        - title: specific and honest. Not clickbait. Not a question unless it's a genuinely good one.
        - content: full markdown. All headers, code blocks, and prose included.
        - tags: 3-6 tags from this list only: {[c['name'] for c in category_list]} — \
          wait, tags not categories. Use relevant technical terms as tags.
        - category_id: must be one of the provided category UUIDs exactly."""

        user_prompt = f"""Write a blog post on this topic: {topic}

        ═══════════════════════════════════════════
        RESEARCH BRIEF
        ═══════════════════════════════════════════
        {research}

        Key concepts the post must handle correctly:
        {concepts_text}

        Angles worth exploring (pick 1-2, don't try to cover all):
        {angles_text}

        Sources worth citing or linking:
        {sources_text}

        ═══════════════════════════════════════════
        PAST POSTS (for continuity and cross-references)
        ═══════════════════════════════════════════
        {past_titles_text}

        If any past post title is directly related to this topic, consider a brief natural \
        cross-reference in the content — not a forced plug, just an honest "I wrote about X \
        before" where it adds value.

        Now write the post. Sound like the author. Make it worth reading."""

        groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

        generation = span.start_observation(
            name="writer_draft_generation",
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
            max_tokens=4096,
            temperature=0.7,
        )

        raw_text = response.choices[0].message.content or ""
        generation.update(
            output=raw_text,
            usage_details={
                "input": response.usage.prompt_tokens if response.usage else 0,
                "output": response.usage.completion_tokens if response.usage else 0,
            },
        )
        generation.end()

        try:
            parsed = json.loads(raw_text)
            title = parsed["title"]
            content = parsed["content"]
            tags = parsed.get("tags", [])
            category_id = parsed.get("category_id", "")
        except (json.JSONDecodeError, KeyError):
            retry_generation = span.start_observation(
                name="writer_draft_retry",
                as_type="generation",
                model=settings.GROQ_MODEL,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": raw_text},
                    {"role": "user",
                     "content": "Your response was not valid JSON. Reply with ONLY the JSON object, no markdown, no preamble."},
                ],
            )

            retry_response = await groq_client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": raw_text},
                    {"role": "user",
                     "content": "Your response was not valid JSON. Reply with ONLY the JSON object, no markdown, no preamble."},
                ],
                response_format={"type": "json_object"},
                max_tokens=4096,
                temperature=0.7,
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
            title = parsed["title"]
            content = parsed["content"]
            tags = parsed.get("tags", [])
            category_id = parsed.get("category_id", "")

        known_ids = {c["id"] for c in category_list}
        if category_id not in known_ids and category_list:
            fallback = category_list[0]
            logger.warning(
                "LLM returned unknown category_id=%s — using first available: %s (%s)",
                category_id, fallback["name"], fallback["id"],
            )
            category_id = fallback["id"]

        span.update(status_message=f"draft_generated_{len(content)}_chars")
        span.end()
        return {
            "draft_title": title,
            "draft_content": content,
            "draft_tags": tags,
            "draft_category_id": category_id,
        }

    except Exception as exc:
        span.update(level="ERROR", status_message=str(exc))
        span.end()
        raise RuntimeError(f"writer_node failed: {exc}") from exc


_TONE_FALLBACK = (
    "Write in a clear, practical, developer-focused style. "
    "Use short paragraphs and concrete examples over abstract theory. "
    "Keep a direct, confident tone."
)
