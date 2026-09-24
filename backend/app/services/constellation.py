"""The constellation: the site index as a graph.

    stars   pages, and the sections of a page (a notes volume is a star with
            its sections around it)
    lines   part    section → its page
            link    a real hyperlink between two pages (or to a section)
            similar a section's nearest neighbours by meaning, on other pages

"similar" comes free from the index: every passage already has an embedding,
so a section's direction is the mean of its passages', and its neighbours are
the closest other directions. Cross-page only — sections of one page are
already tied together by "part".

Built from site_chunks and site_links, so it is exactly as fresh as the index
and costs no model calls. Cached in-process; a rebuild clears the cache.
"""

from __future__ import annotations

import time
from collections import defaultdict

import numpy as np
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_chunk import SiteChunk, SiteLink

#: A section's k nearest neighbours on other pages, above this cosine similarity.
SIMILAR_K = 2
SIMILAR_MIN = 0.45

_cache: tuple[float, dict] | None = None
_TTL = 600


def invalidate() -> None:
    global _cache
    _cache = None


def similar_pairs(
    ids: list[str], vectors: np.ndarray, page_of: dict[str, str], k: int = SIMILAR_K, floor: float = SIMILAR_MIN
) -> list[tuple[str, str, float]]:
    """Each node's k nearest nodes on a *different* page, above `floor`.
    Undirected and de-duplicated. Pure."""
    if len(ids) < 2:
        return []
    unit = vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9)
    sims = unit @ unit.T
    pages = np.array([page_of[i] for i in ids])
    sims[pages[:, None] == pages[None, :]] = -1.0  # same page (and self): never "similar"
    out: dict[tuple[str, str], float] = {}
    for a in range(len(ids)):
        for b in np.argsort(-sims[a])[:k]:
            s = float(sims[a, b])
            if s < floor:
                break
            key = (ids[a], ids[b]) if ids[a] < ids[b] else (ids[b], ids[a])
            out[key] = max(out.get(key, s), s)
    return [(a, b, round(s, 3)) for (a, b), s in sorted(out.items())]


async def graph(db: AsyncSession) -> dict:
    """{nodes, edges} for the constellation page."""
    global _cache
    if _cache and time.time() - _cache[0] < _TTL:
        return _cache[1]

    rows = (
        await db.execute(
            select(SiteChunk.page_url, SiteChunk.url, SiteChunk.kind, SiteChunk.title, SiteChunk.heading, SiteChunk.embedding)
        )
    ).all()

    nodes: dict[str, dict] = {}
    vectors: dict[str, list[np.ndarray]] = defaultdict(list)
    passages: dict[str, int] = defaultdict(int)
    for page_url, url, kind, title, heading, emb in rows:
        nodes.setdefault(page_url, {"id": page_url, "label": title, "kind": kind, "url": page_url, "page": None})
        passages[page_url] += 1
        # A section star for anchored passages with a heading; the rest belong to the page.
        node_id = url if (url != page_url and heading) else page_url
        if node_id != page_url:
            nodes.setdefault(node_id, {"id": node_id, "label": heading, "kind": "section", "url": url, "page": page_url})
            passages[node_id] += 1
        if emb is not None:
            vectors[node_id].append(np.asarray(emb, dtype=np.float32))

    edges: list[dict] = [
        {"source": n["id"], "target": n["page"], "kind": "part", "weight": 1.0} for n in nodes.values() if n["page"]
    ]

    # Real links, landing on a section when the anchor is one we know. A
    # database the links migration hasn't reached yet just has none.
    try:
        links = (await db.execute(select(SiteLink.from_url, SiteLink.to_url).distinct())).all()
    except DBAPIError:
        await db.rollback()
        links = []
    for from_url, to_url in links:
        target = to_url if to_url in nodes else to_url.split("#")[0]
        if from_url in nodes and target in nodes and target != from_url:
            edges.append({"source": from_url, "target": target, "kind": "link", "weight": 1.0})

    # Meaning: sections (and pages without sections) against each other.
    has_sections = {n["page"] for n in nodes.values() if n["page"]}
    leaves = [i for i, n in nodes.items() if (n["page"] or i not in has_sections) and vectors.get(i)]
    if leaves:
        matrix = np.stack([np.mean(vectors[i], axis=0) for i in leaves])
        page_of = {i: nodes[i]["page"] or i for i in leaves}
        for a, b, s in similar_pairs(leaves, matrix, page_of):
            edges.append({"source": a, "target": b, "kind": "similar", "weight": s})

    for n in nodes.values():
        n["passages"] = passages[n["id"]]
    result = {"nodes": list(nodes.values()), "edges": edges}
    _cache = (time.time(), result)
    return result
