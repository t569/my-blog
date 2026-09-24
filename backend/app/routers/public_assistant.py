"""Public assistant chat — a streaming, stateless conversation about the blog.

Off unless ``ASSISTANT_ENABLED`` and ``GROQ_API_KEY`` are both set, in which
case it answers 404 as if it did not exist. The frontend widget speaks the SSE
frame format of ``@t569/ai-assistant``: one JSON object per ``data:`` line,
``actionStatus`` for what the character should look like and ``delta`` for the
next piece of the reply.
"""

import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncIterator
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from groq import AsyncGroq
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import get_db
from app.middleware.rate_limit import RateLimiter
from app.models.post import Post
from app.models.series import Series
from app.services import character_service, search_service
from app.services.assistant_shortcuts import answer_cache, answer_without_model, normalize

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Assistant (Public)"])

_per_ip = RateLimiter(
    max_requests=settings.ASSISTANT_HOURLY_LIMIT_PER_IP,
    window_seconds=3600,
    detail="That's a lot of questions for one hour. Try again a little later.",
)
_total = RateLimiter(
    max_requests=settings.ASSISTANT_HOURLY_LIMIT_TOTAL,
    window_seconds=3600,
    detail="The assistant is resting for a bit. Try again later.",
)


class ChatTurn(BaseModel):
    # No "system": the prompt is the server's, never the caller's.
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    threadId: str = Field("", max_length=100)
    message: str = Field(..., min_length=1, max_length=1000)
    messages: list[ChatTurn] = Field(default_factory=list, max_length=20)


# ponytail: a module-level cache; per-process, which is what one Render
# instance has. Ten minutes is plenty for a list of titles.
_catalogue: tuple[float, str] = (0.0, "")
_CATALOGUE_TTL = 600

#: Caps on what a single model call carries, in characters. The prompt is paid
#: for on every message, so each part is bounded rather than trusted to stay small.
_GUIDE_MAX = 4000
_PASSAGE_MAX = 700
_PASSAGES_MAX = 2400
_RETRIEVAL_TIMEOUT = 6.0


async def _site_context(db: AsyncSession) -> str:
    """Everything about the site the database can say: pages, series, posts."""
    global _catalogue
    stamp, text = _catalogue
    if text and time.time() - stamp < _CATALOGUE_TTL:
        return text

    posts = (
        await db.execute(
            select(Post.title, Post.slug, Post.excerpt, Post.series_id, Post.series_order)
            .where(Post.status == "published", Post.deleted_at.is_(None))
            .order_by(Post.published_at.desc())
            .limit(40)
        )
    ).all()
    series = (
        await db.execute(
            select(Series.id, Series.title, Series.slug, Series.description).where(Series.status == "published")
        )
    ).all()

    post_lines = [
        f"- {title} (/posts/{slug}): {(excerpt or '').strip()[:160]}" for title, slug, excerpt, _, _ in posts
    ]
    series_lines = []
    for sid, title, slug, description in series:
        parts = sorted((order or 0, t) for t, _, _, s_id, order in posts if s_id == sid)
        listing = "; ".join(f"{i}. {t}" for i, (_, t) in enumerate(parts, 1)) or "no published parts yet"
        about = f" — {description.strip()[:160]}" if description else ""
        series_lines.append(f"- {title} (/series/{slug}){about}. Parts: {listing}")

    text = (
        "Pages: / (home: the feed of posts), /series (posts grouped into series), "
        "/about (the author), /posts/<slug> (a post).\n\n"
        "Series:\n" + ("\n".join(series_lines) or "(none yet)") + "\n\n"
        "Posts, newest first:\n" + ("\n".join(post_lines) or "(no posts yet)")
    )
    _catalogue = (time.time(), text)
    return text


def _site_guide() -> str:
    """The owner's own description of the site, from config. Bounded."""
    guide = settings.ASSISTANT_SITE_GUIDE.replace("\\n", "\n").strip()
    return guide[:_GUIDE_MAX]


async def _passages(db: AsyncSession, question: str) -> str:
    """The post passages most relevant to the question, from the site's own
    hybrid search (meaning + keywords, over post chunks).

    Best-effort by design: the embedding call is a network round trip, so it
    gets a deadline, and anything that goes wrong means answering from the
    site map alone rather than not answering.
    """
    try:
        results = await asyncio.wait_for(
            search_service.semantic_search(db, question, limit=4), timeout=_RETRIEVAL_TIMEOUT
        )
    except Exception:
        logger.warning("[assistant] retrieval unavailable; answering without passages", exc_info=True)
        return ""
    out: list[str] = []
    used = 0
    for r in results:
        chunk = " ".join((r.matched_chunk or "").split())[:_PASSAGE_MAX]
        if not chunk:
            continue
        entry = f'From "{r.post.title}" (/posts/{r.post.slug}):\n{chunk}'
        if used + len(entry) > _PASSAGES_MAX:
            break
        out.append(entry)
        used += len(entry)
    return "\n\n".join(out)


def _system_prompt(site: str, guide: str, passages: str) -> str:
    parts = [
        f"You are {settings.ASSISTANT_NAME}, {settings.ASSISTANT_PERSONA}. "
        "You live on a personal blog and talk with its readers. Be warm, brief "
        "and concrete: a few sentences unless asked for more. Point readers to "
        "the right page or post by its link path. Answer from what is below; "
        "if it isn't there, say so rather than invent it. You are the site's "
        "guide, not its author: the posts, notes, lab and software are the "
        "author's work, never yours. Write short paragraphs or a plain '- ' "
        "list; **bold** is fine; never use tables, headings or code formatting "
        "(write paths like /notes plainly) — the chat window can't show them.",
        f"About this site:\n{site}",
    ]
    if guide:
        parts.append(f"From the author, about the site:\n{guide}")
    if passages:
        parts.append(
            "Passages from posts that match the reader's question — prefer these "
            f"when answering, and name the post you draw on:\n{passages}"
        )
    return "\n\n".join(parts)


def _frame(action_status: str, delta: str | None = None) -> str:
    event: dict[str, object] = {"node": None, "actionStatus": action_status, "state": {}}
    if delta:
        event["delta"] = delta
    return f"data: {json.dumps(event)}\n\n"


_HISTORY_TURNS = 6


def _stream_text(text: str) -> StreamingResponse:
    """A reply that needs no model, streamed word by word.

    Paced like a real reply so the character still visibly speaks — sending it
    in one frame would make a free answer look like a glitch.
    """

    async def stream() -> AsyncIterator[str]:
        yield _frame("processing")
        for piece in re.findall(r"\S+\s*", text):
            yield _frame("speaking", piece)
            await asyncio.sleep(0.03)
        yield _frame("idle")

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/assistant/profile")
async def profile(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """The assistant's face for the public widget — null means the built-in one.

    Only the assistant: the agents' faces are an admin concern.
    """
    if not settings.assistant_ready:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    choices, _ = await character_service.get_characters(db)
    return {cid: choices.get(cid) for cid in character_service.PUBLIC_IDS}


@router.post("/assistant/chat")
async def chat(
    data: ChatRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    """Stream a reply. 404 when the assistant is off; 429 past either limit."""
    if not settings.assistant_ready:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    # Free answers first: they cost no tokens, so they don't spend the limits
    # either — the limits exist to protect the model bill.
    free = answer_without_model(data.message, has_history=bool(data.messages))
    if free:
        kind, text = free
        logger.info("[assistant] answered without a model (%s)", kind)
        return _stream_text(text)

    _per_ip.check(request)
    _total.check(request, key="*")

    # Read before streaming: the session dependency closes once the handler
    # returns, which is before the generator below finishes.
    site = await _site_context(db)
    passages = await _passages(db, data.message)
    messages = [
        {"role": "system", "content": _system_prompt(site, _site_guide(), passages)},
        # The last few turns are plenty for a chat about blog posts, and every
        # turn sent is paid for again on every message.
        *({"role": t.role, "content": t.content} for t in data.messages[-_HISTORY_TURNS:]),
        {"role": "user", "content": data.message},
    ]

    async def stream() -> AsyncIterator[str]:
        yield _frame("processing")
        try:
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            # Reasoning models (gpt-oss) think before answering and stream that
            # separately as `reasoning`, which is never shown — it is the time
            # the character spends "processing". Kept short, and the token
            # budget leaves room for it; other models reject the parameter.
            model = settings.ASSISTANT_MODEL or settings.GROQ_MODEL
            reasoning = {"reasoning_effort": "low"} if "gpt-oss" in model else {}
            completion = await client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore[arg-type]
                temperature=0.6,
                max_tokens=900,
                stream=True,
                **reasoning,  # type: ignore[arg-type]
            )
            reply: list[str] = []
            async for chunk in completion:
                piece = chunk.choices[0].delta.content if chunk.choices else None
                if piece:
                    reply.append(piece)
                    yield _frame("speaking", piece)
            yield _frame("idle")
            if not data.messages:
                answer_cache.put(normalize(data.message), "".join(reply))
        except Exception:
            logger.exception("[assistant] chat completion failed")
            yield _frame("failed")

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        # No caching anywhere, and no buffering by proxies that honour the hint,
        # or the reply arrives in one lump at the end.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
