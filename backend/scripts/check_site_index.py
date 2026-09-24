"""Self-check: the site index extracts, splits and links pages correctly.

Run:  python -m scripts.check_site_index   (from backend/)

No database, no network, no model. Pins the parts where a mistake would be
silent: anchors that don't land on the heading, chrome (nav, scripts) leaking
into passages, passages too long for the embedding model to read, the crawler
wandering into /admin or off-site.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")

from app.services.site_index import (  # noqa: E402
    CHUNK_WORDS,
    Page,
    Section,
    _site_path,
    chunk_sections,
    html_page,
    kind_for,
    markdown_sections,
    page_hash,
    slugify_heading,
)

failed = 0


def check(ok: bool, label: str) -> None:
    global failed
    if not ok:
        failed += 1
    print(f"{'ok  ' if ok else 'FAIL'}  {label}")


# ── anchors match the post page's (github-slugger) ──
check(slugify_heading("Hello, World!") == "hello-world", "punctuation dropped, spaces become hyphens")
check(slugify_heading("C++ & Rust") == "c--rust", "matches github-slugger on symbols")
seen: dict[str, int] = {}
check([slugify_heading("Notes", seen), slugify_heading("Notes", seen)] == ["notes", "notes-1"], "repeats are numbered like rehype-slug")

# ── markdown: headings split sections; code fences don't ──
md = "Intro text.\n\n## First part\nAlpha **bold**.\n\n```py\n# not a heading\nx = 1\n```\n\n### Sub\nBeta [link](https://x)."
secs = markdown_sections(md)
check([s.heading for s in secs] == ["", "First part", "Sub"], "sections at #–### only, not inside code")
check(secs[1].anchor == "first-part" and "bold" in secs[1].text and "**" not in secs[1].text, "markdown stripped, anchor made")
check("link" in secs[2].text and "https" not in secs[2].text, "links keep their text, lose their URL")

# ── HTML: main content only, section ids as anchors, chrome skipped ──
html = """<html><head><title>Vol II — Site</title><style>.x{}</style></head><body>
<nav><a href="/admin">Admin</a> Menu words</nav>
<main><section id="s1"><h2>The sieve</h2><p>Crossing out multiples.</p><script>var secret=1</script></section>
<section id="s2"><h2 id="bound">A bound</h2><p>It cannot finish.</p><a href="/notes/vol3.html">next</a></section></main>
<footer>Footer words</footer></body></html>"""
title, sections, links = html_page(html)
check(title == "Vol II — Site", "title read")
check([(s.heading, s.anchor) for s in sections] == [("The sieve", "s1"), ("A bound", "bound")],
      "headings split sections; the heading's id wins, else the enclosing section's")
body = " ".join(s.text for s in sections)
check("secret" not in body and "Menu" not in body and "Footer" not in body, "scripts, nav and footer never reach a passage")
check("/notes/vol3.html" in links, "links collected for the crawl")

# ── passages: short enough for the model, overlapping, never across a heading ──
long = Section("H", "h", " ".join(f"w{i}" for i in range(400)))
parts = chunk_sections([long, Section("K", "k", "tail words")])
check(all(len(p.text.split()) <= CHUNK_WORDS for p in parts), f"no passage over {CHUNK_WORDS} words")
check(parts[0].text.split()[-1] in parts[1].text.split(), "consecutive passages overlap")
check(parts[-1].heading == "K" and parts[-1].text == "tail words", "a heading always starts a new passage")

# ── the crawl stays on the public site ──
base = "https://site.example/"
check(_site_path(base, "/notes/vol1.html#s2") == "/notes/vol1.html", "fragments dropped")
for bad in ("/admin/posts", "/api/proxy/x", "/posts/hello", "https://elsewhere.example/x", "/files/cv.pdf", "/lab?x=1"):
    check(_site_path(base, bad) is None, f"not crawled: {bad}")
check(kind_for("/notes/vol2-sieve-theory.html") == "note" and kind_for("/lab") == "lab" and kind_for("/about") == "page", "kinds")

# ── unchanged pages are recognised ──
a = Page("/x", "page", "T", [Section("H", "h", "same")])
b = Page("/x", "page", "T", [Section("H", "h", "same")])
c = Page("/x", "page", "T", [Section("H", "h", "changed")])
check(page_hash(a) == page_hash(b) != page_hash(c), "page hash follows content, nothing else")

from app.services.site_index import strip_site_suffix  # noqa: E402

ps = [Page("/a", "page", "About — Site", []), Page("/b", "lab", "Lab — Site", []), Page("/c", "note", "Sieve Theory", [])]
strip_site_suffix(ps)
check([p.title for p in ps] == ["About", "Lab", "Sieve Theory"], "the shared site-name suffix is stripped")
ps = [Page("/a", "page", "War — Peace", []), Page("/b", "page", "Other", []), Page("/c", "page", "Third", [])]
strip_site_suffix(ps)
check(ps[0].title == "War — Peace", "a suffix only one title has is part of that title")

# ── a real notes volume ──
vol = Path(__file__).resolve().parents[2] / "frontend" / "public" / "notes" / "vol2-sieve-theory.html"
if vol.exists():
    t, s, _ = html_page(vol.read_text(encoding="utf-8"))
    anchored = [x for x in s if x.anchor]
    passages = chunk_sections(s)
    print(f"      vol2: {len(s)} sections, {len(anchored)} with anchors, {len(passages)} passages")
    # The cover (eyebrow + title) sits at the top of the page and needs no
    # anchor; every section after it must link to itself.
    check(len(s) >= 8 and all(x.anchor for x in s[2:]), "a real notes volume splits into anchored sections")
    check(all("§ 1L" not in x.heading for x in s) and any(x.heading.startswith("§ 1 ") for x in s),
          "a heading's parts stay separate words")
else:
    print("      (skipped: frontend/public/notes not present)")

print()
if failed:
    print(f"{failed} site-index check(s) failed")
    sys.exit(1)
print("all site-index checks passed.")
