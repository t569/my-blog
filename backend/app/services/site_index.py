"""The site-wide index: every page a reader can reach, searchable by meaning.

    posts (from the database) ─┐
                               ├─> sections ─> ~150-word passages ─> embeddings ─> site_chunks (HNSW)
    pages (crawled from SITE_URL)┘

Why a second index beside post_embeddings: that one covers posts only and
serves the search bar, and it stays as it is. This one covers everything —
a notes collection, a lab, the about page — because the assistant should know
the whole site, and the constellation should draw it.

Why ~150 words: the embedding model (all-MiniLM-L6-v2) reads only the first
256 word-pieces of its input — roughly 200 words — and ignores the rest. A
passage longer than that is searchable only by its opening; 150 words plus a
title-and-heading prefix fits whole.

Why crawl rather than read files: the backend and the frontend deploy
separately, and a crawl indexes exactly what a reader sees — including pages
that are only static files on the frontend. Pages are hashed, so a rebuild
only embeds what changed.

The parsing and chunking functions are pure and checked by
`scripts/check_site_index.py`.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlparse

import httpx
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.post import Post
from app.models.site_chunk import SiteChunk
from app.services.embedding_service import _strip_markdown, get_embeddings

logger = logging.getLogger(__name__)

CHUNK_WORDS = 150
OVERLAP_WORDS = 30
EMBED_BATCH = 32
MAX_PAGES = 80

#: Never crawled: private, machine-only, or already indexed from the database.
SKIP_PREFIXES = ("/admin", "/api", "/_next", "/posts/")


# ---------------------------------------------------------------- pure parts


@dataclass
class Section:
    heading: str
    anchor: str
    text: str


@dataclass
class Page:
    path: str
    kind: str
    title: str
    sections: list[Section]
    links: list[str] = field(default_factory=list)
    post_id: uuid.UUID | None = None


def slugify_heading(text_: str, seen: dict[str, int] | None = None) -> str:
    """Heading → anchor, the way github-slugger (rehype-slug) does it, so an
    anchor made here lands on the heading the post page renders."""
    slug = re.sub(r"[^\w\- ]", "", text_.strip().lower()).replace(" ", "-")
    if seen is None:
        return slug
    n = seen.get(slug, 0)
    seen[slug] = n + 1
    return slug if n == 0 else f"{slug}-{n}"


def markdown_sections(markdown: str) -> list[Section]:
    """Split a post on its #, ## and ### headings, each section plain text."""
    sections: list[Section] = []
    seen: dict[str, int] = {}
    heading, anchor, buf = "", "", []
    fenced = False
    for line in markdown.splitlines():
        if line.lstrip().startswith("```"):
            fenced = not fenced  # a "# comment" in a code block is not a heading
        m = None if fenced else re.match(r"^(#{1,3})\s+(.+?)\s*#*\s*$", line)
        if m:
            sections.append(Section(heading, anchor, _strip_markdown("\n".join(buf))))
            heading = m.group(2).strip()
            anchor = slugify_heading(heading, seen)
            buf = []
        else:
            buf.append(line)
    sections.append(Section(heading, anchor, _strip_markdown("\n".join(buf))))
    return [s for s in sections if s.text.strip()]


class _Extractor(HTMLParser):
    """Visible text of a page, split at h1–h3, plus its links.

    Inside <main> when the page has one (site chrome is outside it). Skips
    scripts, styles, SVG, nav, header, footer and form controls. A section's
    anchor is its heading's id, or failing that the nearest enclosing element
    with an id — the notes volumes put ids on <section>, not on headings.
    """

    SKIP = {"script", "style", "noscript", "svg", "nav", "header", "footer", "button", "select", "canvas", "template", "form"}
    BLOCK = {"p", "div", "li", "br", "tr", "td", "th", "section", "article", "blockquote", "pre", "figure", "figcaption", "dd", "dt"}
    HEADINGS = {"h1", "h2", "h3"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.links: list[str] = []
        self.has_main = False
        self._in_main = 0
        self._skip = 0
        self._in_title = False
        self._heading: list[str] | None = None
        self._heading_id = ""
        self._ids: list[str | None] = []
        self.sections: list[Section] = [Section("", "", "")]
        self._main_sections: list[Section] = []

    def _current(self) -> Section:
        return self.sections[-1]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if self._heading is not None:
            # "<span>§ 1</span>Legendre's sieve" — keep the parts apart.
            self._heading.append(" ")
        if tag == "a" and a.get("href"):
            self.links.append(a["href"] or "")
        if tag in {"br", "img", "hr", "meta", "link", "input"}:
            if tag == "br":
                self._current().text += " "
            return
        self._ids.append(a.get("id"))
        if tag == "title":
            self._in_title = True
        if tag == "main":
            if not self.has_main:
                # Start collecting afresh: everything before <main> was chrome.
                self.sections = [Section("", self._nearest_id(), "")]
            self.has_main = True
            self._in_main += 1
        if tag in self.SKIP:
            self._skip += 1
        if tag in self.HEADINGS and not self._skip:
            self._heading = []
            self._heading_id = a.get("id") or ""
        if tag in self.BLOCK:
            self._current().text += " "

    def handle_endtag(self, tag: str) -> None:
        if tag in {"br", "img", "hr", "meta", "link", "input"}:
            return
        if self._heading is not None and tag not in self.HEADINGS:
            self._heading.append(" ")
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        if tag in self.HEADINGS and self._heading is not None:
            heading = " ".join("".join(self._heading).split())
            anchor = self._heading_id or self._nearest_id()
            self._heading = None
            if heading and self._collecting():
                self.sections.append(Section(heading, anchor, ""))
        if tag == "main" and self._in_main:
            self._in_main -= 1
        if self._ids:
            self._ids.pop()

    def _nearest_id(self) -> str:
        for i in reversed(self._ids):
            if i:
                return i
        return ""

    def _collecting(self) -> bool:
        return not self._skip and (self._in_main > 0 or not self.has_main)

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
            return
        if self._heading is not None:
            self._heading.append(data)
            return
        if self._collecting():
            self._current().text += data


def html_page(html: str) -> tuple[str, list[Section], list[str]]:
    """(title, sections, links) of an HTML page. Pure."""
    p = _Extractor()
    p.feed(html)
    p.close()
    sections = [Section(s.heading, s.anchor, " ".join(s.text.split())) for s in p.sections]
    return " ".join(p.title.split()), [s for s in sections if s.text], p.links


def chunk_sections(sections: list[Section], words: int = CHUNK_WORDS, overlap: int = OVERLAP_WORDS) -> list[Section]:
    """Split sections into passages of at most `words` words, overlapping by
    `overlap` so a sentence cut at a boundary is still whole in one of them.
    Passages never cross a heading. Pure."""
    out: list[Section] = []
    step = max(1, words - overlap)
    for s in sections:
        ws = s.text.split()
        if not ws:
            continue
        for start in range(0, len(ws), step):
            out.append(Section(s.heading, s.anchor, " ".join(ws[start : start + words])))
            if start + words >= len(ws):
                break
    return out


def kind_for(path: str) -> str:
    if path.startswith("/posts/"):
        return "post"
    if path.startswith("/notes/") and path.endswith(".html"):
        return "note"
    if path.startswith("/lab"):
        return "lab"
    if path.startswith("/series"):
        return "series"
    return "page"


def page_hash(page: Page) -> str:
    h = hashlib.sha256(page.title.encode())
    for s in page.sections:
        h.update(f"\x00{s.heading}\x00{s.anchor}\x00{s.text}".encode())
    return h.hexdigest()


def embed_text(page: Page, s: Section) -> str:
    """What the model embeds: the passage, prefixed with where it lives, so
    'the proof in section 3' still carries which page it belongs to."""
    where = f"{page.title} — {s.heading}" if s.heading else page.title
    return f"{where}: {s.text}"


# ------------------------------------------------------------------ gathering


async def posts_as_pages(db: AsyncSession) -> list[Page]:
    rows = (
        await db.execute(
            select(Post.id, Post.slug, Post.title, Post.content).where(
                Post.status == "published", Post.deleted_at.is_(None)
            )
        )
    ).all()
    return [
        Page(path=f"/posts/{slug}", kind="post", title=title, sections=markdown_sections(content or ""), post_id=pid)
        for pid, slug, title, content in rows
    ]


def _site_path(base: str, href: str) -> str | None:
    """A same-site path worth crawling, or None."""
    absolute, _ = urldefrag(urljoin(base, href))
    u, b = urlparse(absolute), urlparse(base)
    if u.scheme not in ("http", "https") or u.netloc != b.netloc or u.query:
        return None
    path = u.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    if any(path.startswith(p) for p in SKIP_PREFIXES):
        return None
    if "." in path.rsplit("/", 1)[-1] and not path.endswith(".html"):
        return None  # a pdf, an image, a script — not a page
    return path


async def crawl(site_url: str, max_pages: int = MAX_PAGES) -> list[Page]:
    """Breadth-first from the home page, following the site's own links.

    The home page is crawled for its links but not indexed: it is a feed of
    post excerpts, and the posts are indexed whole from the database.
    """
    base = site_url.rstrip("/") + "/"
    queue, seen, pages = ["/"], {"/"}, []
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers={"User-Agent": "site-index"}) as client:
        while queue and len(seen) <= max_pages:
            path = queue.pop(0)
            try:
                res = await client.get(urljoin(base, path.lstrip("/")))
            except httpx.HTTPError:
                logger.warning("[site-index] could not fetch %s", path)
                continue
            if res.status_code != 200 or "html" not in res.headers.get("content-type", ""):
                continue
            title, sections, links = html_page(res.text)
            for href in links:
                nxt = _site_path(base, href)
                if nxt and nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
            if path != "/" and sections:
                pages.append(Page(path=path, kind=kind_for(path), title=title or path, sections=sections))
    strip_site_suffix(pages)
    return pages


def strip_site_suffix(pages: list[Page]) -> None:
    """Drop the " — Site Name" most titles end with: it's on every page, so it
    tells a passage apart from nothing, and it costs words in every embedding.
    Only when most titles share it, so a real title is never clipped. Pure."""
    tails = [p.title.rsplit(" — ", 1)[1] for p in pages if " — " in p.title]
    if not tails:
        return
    common = max(set(tails), key=tails.count)
    if tails.count(common) * 2 <= len(pages):
        return
    for p in pages:
        if p.title.endswith(" — " + common):
            p.title = p.title[: -len(" — " + common)]


# ---------------------------------------------------------------- indexing


@dataclass
class IndexReport:
    pages: int = 0
    changed: int = 0
    unchanged: int = 0
    removed: int = 0
    chunks: int = 0
    embedded: int = 0
    crawled: bool = False
    site_url: str | None = None
    finished_at: datetime | None = None
    error: str | None = None


async def _embed(texts: list[str]) -> list[list[float] | None]:
    out: list[list[float] | None] = []
    for i in range(0, len(texts), EMBED_BATCH):
        batch = texts[i : i + EMBED_BATCH]
        try:
            out.extend(await get_embeddings(batch))
        except Exception:
            # Keep the passages: keyword search still finds them, and the next
            # rebuild retries (their page hash is stored as not-yet-embedded).
            logger.warning("[site-index] embedding batch failed", exc_info=True)
            out.extend([None] * len(batch))
    return out


async def index_pages(db: AsyncSession, pages: list[Page], report: IndexReport, *, prune_kinds: set[str]) -> None:
    """Write `pages`, re-embedding only those whose text changed; remove
    indexed pages of `prune_kinds` that no longer exist."""
    existing = {
        url: h
        for url, h, missing in (
            await db.execute(
                select(SiteChunk.page_url, func.min(SiteChunk.page_hash), func.bool_or(SiteChunk.embedding.is_(None))).group_by(
                    SiteChunk.page_url
                )
            )
        ).all()
        if not missing  # a page with an un-embedded passage is re-done
    }
    all_existing = set((await db.execute(select(SiteChunk.page_url, SiteChunk.kind).distinct())).all())

    for page in pages:
        report.pages += 1
        h = page_hash(page)
        if existing.get(page.path) == h:
            report.unchanged += 1
            continue
        passages = chunk_sections(page.sections)
        vectors = await _embed([embed_text(page, s) for s in passages])
        await db.execute(delete(SiteChunk).where(SiteChunk.page_url == page.path))
        for i, (s, v) in enumerate(zip(passages, vectors)):
            db.add(
                SiteChunk(
                    page_url=page.path,
                    url=f"{page.path}#{s.anchor}" if s.anchor else page.path,
                    kind=page.kind,
                    title=page.title,
                    heading=s.heading,
                    chunk_index=i,
                    text=s.text,
                    embedding=v,
                    page_hash=h,
                    post_id=page.post_id,
                )
            )
        report.changed += 1
        report.chunks += len(passages)
        report.embedded += sum(v is not None for v in vectors)
        await db.commit()

    live = {p.path for p in pages}
    gone = [url for url, kind in all_existing if kind in prune_kinds and url not in live]
    if gone:
        await db.execute(delete(SiteChunk).where(SiteChunk.page_url.in_(gone)))
        report.removed = len(gone)
        await db.commit()


#: The last rebuild, for the admin status endpoint. In-process, like the rest.
last_report: IndexReport | None = None
_lock = asyncio.Lock()


async def rebuild(db: AsyncSession, site_url: str | None = None) -> IndexReport:
    """Index every published post, then crawl the site (if an address is known) for the rest."""
    global last_report
    site = settings.SITE_URL or site_url
    report = IndexReport(site_url=site)
    async with _lock:
        try:
            await index_pages(db, await posts_as_pages(db), report, prune_kinds={"post"})
            if site:
                pages = await crawl(site)
                report.crawled = True
                await index_pages(db, pages, report, prune_kinds={"note", "lab", "series", "page"})
        except Exception as exc:
            logger.exception("[site-index] rebuild failed")
            report.error = str(exc)
        report.finished_at = datetime.now()
        last_report = report
    return report


async def index_post(db: AsyncSession, post_id: uuid.UUID) -> None:
    """Re-index one post — called after it is saved, so edits show up without a rebuild."""
    pages = [p for p in await posts_as_pages(db) if p.post_id == post_id]
    if pages:
        await index_pages(db, pages, IndexReport(), prune_kinds=set())
    else:  # unpublished or deleted
        await db.execute(delete(SiteChunk).where(SiteChunk.post_id == post_id))
        await db.commit()


# ------------------------------------------------------------------ searching


@dataclass
class Hit:
    url: str
    page_url: str
    kind: str
    title: str
    heading: str
    text: str
    score: float


async def search(db: AsyncSession, query: str, limit: int = 5) -> list[Hit]:
    """Nearest passages by meaning (HNSW, cosine), or by keyword when the
    embedding call is unavailable. Empty when nothing is indexed yet."""
    vector = None
    try:
        vector = (await get_embeddings([query]))[0]
    except Exception:
        logger.warning("[site-index] query embedding unavailable; keyword search", exc_info=True)

    if vector is not None:
        distance = SiteChunk.embedding.cosine_distance(vector)
        rows = (
            await db.execute(
                select(SiteChunk, (1 - distance).label("score"))
                .where(SiteChunk.embedding.is_not(None))
                .order_by(distance)
                .limit(limit)
            )
        ).all()
    else:
        words = [w for w in re.findall(r"\w{4,}", query.lower())][:6]
        if not words:
            return []
        rows = (
            await db.execute(
                select(SiteChunk, text("0.0").label("score"))
                .where(or_(*(SiteChunk.text.ilike(f"%{w}%") for w in words)))
                .limit(limit)
            )
        ).all()
    return [Hit(c.url, c.page_url, c.kind, c.title, c.heading, c.text, float(score)) for c, score in rows]


async def counts(db: AsyncSession) -> dict[str, int]:
    rows = (await db.execute(select(SiteChunk.kind, func.count()).group_by(SiteChunk.kind))).all()
    return {kind: n for kind, n in rows}
