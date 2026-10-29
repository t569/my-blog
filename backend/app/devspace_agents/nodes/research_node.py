"""Research node — web search and source summarization."""

import json
import logging

from groq import AsyncGroq
from tavily import TavilyClient

from app.config import settings
from app.devspace_agents.langfuse.client import langfuse
from app.devspace_agents.llm import create_json
from app.devspace_agents.pipeline.state import AgentState

logger = logging.getLogger(__name__)


async def research_node(state: AgentState) -> dict:
    span = langfuse.start_observation(
        trace_context={"id": state["langfuse_trace_id"]},
        name="research_node",
        as_type="span",
    )
    try:
        if not settings.TAVILY_API_KEY:
            logger.warning("TAVILY_API_KEY not set — skipping research.")
            span.update(status_message="tavily_skipped_no_key")
            span.end()
            return {"research_results": [], "research_summary": ""}

        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        results = client.search(
            query=state["topic"],
            max_results=5,
            search_depth="advanced",
        )
        raw_results = results.get("results", [])

        span.create_event(
            name="tavily_search",
            input={"query": state["topic"], "max_results": 5},
            output={"result_count": len(raw_results)},
        )

        if not raw_results:
            span.update(status_message="no_sources_found")
            span.end()
            return {"research_results": [], "research_summary": ""}

        sources_text = "\n\n".join(
            f"Title: {r.get('title', '')}\nURL: {r.get('url', '')}\n{r.get('content', '')[:2000]}"
            for r in raw_results
        )

        system_prompt = """You are a research assistant preparing source material for a technical blog post. \
        Your job is NOT to write the post — your job is to produce a structured research brief that gives \
        the post author everything they need to write something accurate, current, and non-shallow.

        The author values fundamentals. Do not summarise surface-level takes. Prioritise:
        - What the current state of the art actually is (not what it was two years ago)
        - Foundational concepts or mechanics that explain WHY something works, not just WHAT it does
        - Real data, benchmarks, or failure cases where available
        - Specific tools, libraries, papers, or implementations worth referencing
        - Conflicting perspectives or trade-offs that make the topic interesting

        OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no preamble:
        {
          "summary": "...",
          "key_concepts": ["...", "..."],
          "notable_sources": [{"title": "...", "url": "...", "why_relevant": "..."}],
          "angles": ["...", "..."]
        }

        - "summary": 250-350 words. Prose. Dense with specifics. No filler.
        - "key_concepts": 3-6 concepts the post must explain correctly to be credible.
        - "notable_sources": up to 3 sources worth citing or linking in the post (from the search results).
        - "angles": 2-4 specific angles or sub-questions the author could explore in the post \
          (e.g. "why X breaks at scale", "the X vs Y trade-off most tutorials skip", \
          "what X actually looks like in a production codebase")."""

        user_prompt = f"""Topic: {state['topic']}

        Web search results:
        {sources_text}

        Produce a research brief. Prioritise depth over breadth. The author writes medium-to-long form \
        technical posts (1000-2000 words) for a technical audience — assume the reader can handle \
        complexity. Surface what is genuinely interesting about this topic, not just what is easy to explain."""

        groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

        generation = span.start_observation(
            name="research_summarise",
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
            summary = parsed.get("summary", "")
            key_concepts = parsed.get("key_concepts", [])
            angles = parsed.get("angles", [])
            notable_sources = parsed.get("notable_sources", [])
        except (json.JSONDecodeError, KeyError):
            summary = response_text
            key_concepts = []
            angles = []
            notable_sources = []

        span.update(status_message=f"{len(raw_results)}_sources_found")
        span.end()

        return {
            "research_results": [
                {"title": r.get("title", ""), "url": r.get("url", ""),
                 "content": r.get("content", ""), "score": r.get("score", 0)}
                for r in raw_results
            ],
            "research_summary": summary,
            "research_key_concepts": key_concepts,
            "research_angles": angles,
            "research_notable_sources": notable_sources,
        }

    except Exception as exc:
        span.update(level="ERROR", status_message=str(exc))
        span.end()
        raise RuntimeError(f"research_node failed: {exc}") from exc
