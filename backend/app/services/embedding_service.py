"""Embedding service — content chunking and vector generation.

Uses the HuggingFace Inference API (free tier) with the
``sentence-transformers/all-MiniLM-L6-v2`` model (384 dimensions).
"""

import logging
import re
import uuid
from dataclasses import dataclass

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import async_session_factory
from app.models.agent import PostEmbedding
from app.models.post import Post

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
_HF_API_URL = (
    f"https://router.huggingface.co/hf-inference/models/{_MODEL_ID}/pipeline/feature-extraction"
)

# Chunking parameters (in approximate word counts).
_CHUNK_WORDS = 750  # ~1000 tokens
_OVERLAP_WORDS = 75  # ~100 tokens


# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------


@dataclass
class TextChunk:
    """A segment of post content ready for embedding."""

    index: int
    text: str


def _strip_markdown(text: str) -> str:
    """Remove common markdown formatting for cleaner embeddings."""
    # Remove images.
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    # Remove links but keep link text.
    text = re.sub(r"\[([^\]]+)\]\(.*?\)", r"\1", text)
    # Remove heading markers.
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bold/italic markers.
    text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)
    # Remove fenced code blocks entirely.
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Remove inline code backticks.
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Collapse whitespace.
    text = re.sub(r"\s+", " ", text).strip()
    return text


def chunk_post_content(
    title: str,
    excerpt: str | None,
    content: str,
) -> list[TextChunk]:
    """Split a post into chunks suitable for embedding.

    Returns at least one chunk (title + excerpt). Body content is split into
    overlapping segments so that no context is lost at boundaries.
    """
    chunks: list[TextChunk] = []

    # Chunk 0: title + excerpt — the "what is this post about" vector.
    header = title
    if excerpt:
        header += f"\n\n{excerpt}"
    chunks.append(TextChunk(index=0, text=header))

    # Remaining chunks: body content with markdown stripped.
    plain = _strip_markdown(content)
    words = plain.split()

    if not words:
        return chunks

    if len(words) <= _CHUNK_WORDS:
        # Short post — single body chunk.
        chunks.append(TextChunk(index=1, text=plain))
    else:
        idx = 1
        start = 0
        while start < len(words):
            end = min(start + _CHUNK_WORDS, len(words))
            chunk_text = " ".join(words[start:end])
            chunks.append(TextChunk(index=idx, text=chunk_text))
            idx += 1
            if end >= len(words):
                break
            start = end - _OVERLAP_WORDS

    return chunks


# ---------------------------------------------------------------------------
# HuggingFace Inference API
# ---------------------------------------------------------------------------


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate 384-dim embeddings via the free HuggingFace Inference API.

    Sends all texts in a single batch request. Handles both sentence-level
    and token-level responses (mean-pooling if needed).
    """
    if not settings.HUGGINGFACE_TOKEN:
        raise RuntimeError(
            "HUGGINGFACE_TOKEN is not set. "
            "Get a free token at https://huggingface.co/settings/tokens"
        )

    headers = {"Authorization": f"Bearer {settings.HUGGINGFACE_TOKEN}"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            _HF_API_URL,
            json={
                "inputs": texts,
                "options": {"wait_for_model": True},
            },
            headers=headers,
        )
        response.raise_for_status()
        result = response.json()

    # The HF feature-extraction pipeline can return different shapes:
    #   - Sentence-level: [[384 floats], [384 floats], ...]
    #   - Token-level: [[[384 floats], ...], ...]  (needs mean-pooling)
    if not result:
        return []

    # Check dimensionality by inspecting the first element.
    first = result[0]
    if isinstance(first, list) and first and isinstance(first[0], list):
        # Token-level embeddings — mean-pool across tokens.
        pooled = []
        for token_embeds in result:
            n = len(token_embeds)
            dim = len(token_embeds[0])
            mean = [
                sum(token_embeds[t][d] for t in range(n)) / n
                for d in range(dim)
            ]
            pooled.append(mean)
        return pooled

    # Already sentence-level embeddings.
    return result


# ---------------------------------------------------------------------------
# Embedding lifecycle
# ---------------------------------------------------------------------------


async def generate_post_embeddings(
    db: AsyncSession,
    post_id: uuid.UUID,
) -> None:
    """Generate and store embeddings for all chunks of a post.

    Replaces any existing embeddings for the post (idempotent on re-runs).
    """
    # Fetch the post.
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    post = result.scalar_one_or_none()
    if post is None:
        logger.warning("Post %s not found, skipping embedding generation.", post_id)
        return

    # Build chunks.
    chunks = chunk_post_content(post.title, post.excerpt, post.content)

    # Generate embeddings in a single batch.
    try:
        vectors = await get_embeddings([c.text for c in chunks])
    except Exception:
        logger.exception("Failed to generate embeddings for post %s", post_id)
        return

    if len(vectors) != len(chunks):
        logger.error(
            "Embedding count mismatch for post %s: %d chunks, %d vectors",
            post_id,
            len(chunks),
            len(vectors),
        )
        return

    # Delete existing embeddings for this post.
    await db.execute(
        delete(PostEmbedding).where(PostEmbedding.post_id == post_id)
    )

    # Insert fresh embeddings.
    for chunk, vector in zip(chunks, vectors):
        db.add(
            PostEmbedding(
                post_id=post_id,
                chunk_index=chunk.index,
                chunk_text=chunk.text,
                embedding=vector,
            )
        )

    await db.flush()
    logger.info(
        "Generated %d embeddings for post %s", len(chunks), post_id
    )


async def generate_embeddings_background(post_id: uuid.UUID) -> None:
    """Background-task wrapper — opens its own DB session.

    This is called from FastAPI ``BackgroundTasks`` so it must not share
    the request's session (which is already committed/closed).
    """
    async with async_session_factory() as session:
        try:
            await generate_post_embeddings(session, post_id)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception(
                "Background embedding generation failed for post %s", post_id
            )

    # The site-wide index (the assistant's) follows the post too. Separate
    # session and failure: a problem there must not undo the search bar's.
    from app.services import site_index  # imported here: it imports this module

    async with async_session_factory() as session:
        try:
            await site_index.index_post(session, post_id)
        except Exception:
            await session.rollback()
            logger.exception("Site-index update failed for post %s", post_id)
