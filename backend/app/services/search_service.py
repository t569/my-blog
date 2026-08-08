"""Search service — hybrid vector + full‑text search against posts."""

import logging
import re

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import PostEmbedding
from app.models.post import Post
from app.schemas.search import SearchResult, SearchResultPost
from app.services.embedding_service import get_embeddings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# FTS snippet post-processing
# ---------------------------------------------------------------------------

_MARK_PATTERN = re.compile(r"</?mark>")  # placeholder-safe pattern


def _clean_fts_snippet(snippet: str) -> str:
    """Strip markdown formatting from a ``ts_headline`` snippet while
    preserving ``<mark>`` / ``</mark>`` tags intact."""
    if not snippet:
        return snippet

    # 1. Temporarily replace <mark> and </mark> with placeholders.
    parts: list[str] = []
    last_end = 0
    for m in _MARK_PATTERN.finditer(snippet):
        parts.append(snippet[last_end : m.start()])
        parts.append(f"\x00{m.group()}\x00")
        last_end = m.end()
    parts.append(snippet[last_end:])

    # 2. Strip markdown from the non‑placeholder segments.
    cleaned_parts: list[str] = []
    for part in parts:
        if part.startswith("\x00<") and part.endswith(">\x00"):
            # Restore the <mark> or </mark> tag.
            cleaned_parts.append(part.replace("\x00", ""))
            continue

        t = part
        # Remove images: ![alt](url)
        t = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", t)
        # Remove links but keep link text: [text](url)
        t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
        # Remove fenced code blocks entirely.
        t = re.sub(r"```[\s\S]*?```", "", t)
        # Remove heading markers.
        t = re.sub(r"^#{1,6}\s+", "", t, flags=re.MULTILINE)
        # Remove bold / italic markers (paired and unpaired).
        t = re.sub(r"\*\*([^*]*)\*\*", r"\1", t)
        t = re.sub(r"\*\*", "", t)
        t = re.sub(r"__([^_]*)__", r"\1", t)
        t = re.sub(r"__", "", t)
        t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", t)
        t = re.sub(r"(?<!_)_([^_]+)_(?!_)", r"\1", t)
        # Remove inline code backticks.
        t = re.sub(r"`([^`]+)`", r"\1", t)
        # Collapse whitespace (no strip — preserve inter-part spacing).
        t = re.sub(r"\s+", " ", t)

        cleaned_parts.append(t)

    result = "".join(cleaned_parts)
    # Collapse whitespace across tag boundaries and trim.
    result = re.sub(r"\s+", " ", result).strip()
    # Ensure a space before <mark> and after </mark> when adjacent to text.
    result = re.sub(r"(\S)<mark>", r"\1 <mark>", result)
    result = re.sub(r"</mark>(\S)", r"</mark> \1", result)
    return result


async def semantic_search(
    db: AsyncSession,
    query: str,
    *,
    limit: int = 10,
) -> list[SearchResult]:
    """Hybrid search: vector (semantic) + full‑text (keyword) merged together.

    1. **Vector search** – embed the query and find closest post chunks via
       cosine similarity (existing behaviour).
    2. **Full‑text search** – use PostgreSQL ``tsvector`` /
       ``ts_headline()`` to find keyword matches and generate highlighted
       excerpts.  Snippets are post‑processed to remove markdown formatting.
    3. **Merge** – attach ``highlighted_snippet`` to vector results that also
       matched FTS; append any FTS‑only results at the end.
    """
    # -------------------------------------------------------------------
    # 1. Vector search — the optional half.
    #
    # Embeddings need HUGGINGFACE_TOKEN and a network call, either of which
    # can be absent or fail. The full-text half below needs neither, so a
    # missing semantic half degrades search to keyword-only rather than
    # failing the whole request.
    # -------------------------------------------------------------------
    from app.services import feature_service

    vector_rows = []
    query_vector = None

    # Switched off by the owner lands in the same place as unconfigured:
    # keyword-only. Checked before the embedding call, so a disabled feature
    # costs nothing instead of failing after a network round trip.
    if await feature_service.enabled("semantic_search"):
        try:
            vectors = await get_embeddings([query])
            query_vector = vectors[0] if vectors else None
        except Exception:
            logger.warning(
                "Semantic search unavailable — falling back to keyword-only.",
                exc_info=True,
            )

    if query_vector is not None:
        vector_stmt = (
            select(
                PostEmbedding.post_id,
                PostEmbedding.chunk_text,
                (1 - PostEmbedding.embedding.cosine_distance(query_vector)).label(
                    "similarity"
                ),
                Post.title,
                Post.slug,
                Post.excerpt,
                Post.id.label("pid"),
            )
            .join(Post, PostEmbedding.post_id == Post.id)
            .where(
                Post.status == "published",
                Post.deleted_at.is_(None),
                PostEmbedding.embedding.is_not(None),
            )
            .order_by(text("similarity DESC"))
            .limit(limit * 3)
        )

        vector_result = await db.execute(vector_stmt)
        vector_rows = vector_result.all()

    # -------------------------------------------------------------------
    # 2. Full‑text search
    # -------------------------------------------------------------------
    fts_by_post: dict = {}
    try:
        fts_stmt = text("""
            SELECT
                p.id,
                p.title,
                p.slug,
                p.excerpt,
                ts_headline('english',
                    coalesce(p.title, '') || ' ' || coalesce(p.content, ''),
                    plainto_tsquery('english', :q),
                    'StartSel=<mark>, StopSel=</mark>, '
                    'MaxWords=40, MinWords=10, ShortWord=0, MaxFragments=1')
                AS snippet,
                ts_rank(p.search_vector,
                    plainto_tsquery('english', :q)) AS rank
            FROM posts p
            WHERE p.status = 'published'
              AND p.deleted_at IS NULL
              AND p.search_vector @@ plainto_tsquery('english', :q)
            ORDER BY rank DESC
            LIMIT :lim
        """)
        fts_result = await db.execute(fts_stmt, {"q": query, "lim": limit})
        for row in fts_result:
            if row.id is not None:
                fts_by_post[row.id] = {
                    "title": row.title,
                    "slug": row.slug,
                    "excerpt": row.excerpt,
                    "snippet": _clean_fts_snippet(row.snippet) if row.snippet else None,
                    "rank": float(row.rank),
                }
    except Exception:
        logger.exception("FTS query failed — falling back to vector‑only search")

    # -------------------------------------------------------------------
    # 3. Merge
    # -------------------------------------------------------------------
    seen: set = set()
    results: list[SearchResult] = []

    # Normalise FTS ranks to 0-1 (divide by max rank across all FTS results).
    all_ranks = [r["rank"] for r in fts_by_post.values()]
    max_rank = max(all_ranks) if all_ranks else 1.0

    def _normalise_rank(raw: float) -> float:
        return raw / max_rank if max_rank > 0 else 0.0

    # 3a — Vector results first, with FTS snippet + rank attached when available.
    for row in vector_rows:
        if row.post_id in seen:
            continue
        seen.add(row.post_id)

        snippet = None
        fts_rank = 0.0
        if row.post_id in fts_by_post:
            snippet = fts_by_post[row.post_id]["snippet"]
            fts_rank = fts_by_post[row.post_id]["rank"]
            del fts_by_post[row.post_id]

        vec_sim = round(float(row.similarity), 4)

        if fts_rank > 0:
            # Both vector and keyword matched.
            norm = _normalise_rank(fts_rank)
            aggregated_score = max(vec_sim, norm)
            match_type = "hybrid"
        else:
            # Vector only.
            aggregated_score = vec_sim
            match_type = "semantic"

        results.append(
            SearchResult(
                post=SearchResultPost(
                    id=row.pid,
                    title=row.title,
                    slug=row.slug,
                    excerpt=row.excerpt,
                ),
                matched_chunk=row.chunk_text,
                similarity=vec_sim,
                aggregated_score=round(aggregated_score, 4),
                match_type=match_type,
                highlighted_snippet=snippet,
            )
        )

        if len(results) >= limit:
            return results

    # 3b — Remaining FTS‑only results (those not already in vector results).
    for post_id, fts_row in fts_by_post.items():
        norm = _normalise_rank(fts_row["rank"])
        # Floor at 0.3 — a keyword match is always somewhat relevant.
        aggregated_score = max(0.3, norm)

        results.append(
            SearchResult(
                post=SearchResultPost(
                    id=post_id,
                    title=fts_row["title"],
                    slug=fts_row["slug"],
                    excerpt=fts_row["excerpt"],
                ),
                matched_chunk="",
                similarity=0.0,
                aggregated_score=round(aggregated_score, 4),
                match_type="keyword",
                highlighted_snippet=fts_row["snippet"],
            )
        )

        if len(results) >= limit:
            break

    return results
