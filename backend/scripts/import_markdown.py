#!/usr/bin/env python3
"""Import a directory of markdown files as posts.

Usage:
    python -m scripts.import_markdown <content-dir> [options]
    python -m scripts.import_markdown --self-check      # no DB needed

Written for a Quartz digital garden (frontmatter + [[wikilinks]] + a
directory tree), but nothing here is Quartz-specific: any folder of
markdown with YAML frontmatter imports the same way.

Layout conventions, all overridable:

    series/<name>/NN-title.md   -> Series "<name>", series_order = NN
    <dir>/…                     -> category from --map, else --category
    NN-title.md                 -> slug "title" (ordering prefix stripped)

Idempotent — a post whose slug already exists is skipped, so a partial
run can simply be repeated. Requires seed_owner.py and seed_data.py.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml
from slugify import slugify
from sqlalchemy import select

from app.db.base import async_session_factory
from app.models.category import Category
from app.models.owner import Owner
from app.models.post import Post, Tag
from app.models.series import Series

# Root-level files that are the garden's furniture, not posts. Nested
# index.md files ARE content (projects/cloud-ide/index.md is a real page).
DEFAULT_SKIP = {"index.md", "about.md", "admin.md", "cloud-search.md"}

FRONTMATTER = re.compile(r"\A﻿?\s*---\s*\n(.*?)\n---\s*\n", re.DOTALL)
# [[target]] | [[target|label]] | [[target#anchor|label]]
WIKILINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")
ORDER_PREFIX = re.compile(r"^(\d+)[-_.]?\s*")
HEADING = re.compile(r"^#{1,6}\s+(.*)", re.MULTILINE)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Split YAML frontmatter from the body. No frontmatter -> ({}, text)."""
    match = FRONTMATTER.match(text)
    if not match:
        return {}, text.lstrip("﻿")
    meta = yaml.safe_load(match.group(1)) or {}
    if not isinstance(meta, dict):
        meta = {}
    return meta, text[match.end() :]


def slug_for(path: Path, root: Path) -> str:
    """Filename-derived slug, ordering prefix stripped.

    An index.md takes its parent's name, so projects/cloud-ide/index.md
    becomes "cloud-ide" rather than a second "index".
    """
    stem = path.parent.name if path.stem == "index" else path.stem
    return slugify(ORDER_PREFIX.sub("", stem))


def order_for(path: Path) -> int | None:
    match = ORDER_PREFIX.match(path.stem)
    return int(match.group(1)) if match else None


def link_keys(path: Path, root: Path) -> list[str]:
    """Every spelling a wikilink might use to point at this file."""
    rel = path.relative_to(root).with_suffix("").as_posix()
    keys = [rel, path.stem]
    if path.stem == "index":
        keys.append(path.parent.relative_to(root).as_posix())
    return keys


def rewrite_wikilinks(body: str, targets: dict[str, str]) -> str:
    """[[a/b|label]] -> [label](/posts/<slug>); unresolved -> plain text.

    react-markdown renders wikilinks as literal text, and a link to a
    page that was never imported is worse than no link, so anything
    unresolved degrades to its label rather than to a dead href.
    """

    def replace(match: re.Match[str]) -> str:
        target = match.group(1).strip()
        label = (match.group(2) or target.rsplit("/", 1)[-1]).strip()
        slug = targets.get(target) or targets.get(target.rsplit("/", 1)[-1])
        return f"[{label}](/posts/{slug})" if slug else label

    return WIKILINK.sub(replace, body)


def excerpt_for(meta: dict, body: str, limit: int = 200) -> str | None:
    described = meta.get("description") or meta.get("summary")
    if described:
        return str(described).strip()[:limit]
    for block in body.split("\n\n"):
        block = block.strip()
        if block and not block.startswith(("#", ">", "```", "|", "-", "*")):
            flat = " ".join(block.split())
            return flat[: limit - 1] + "…" if len(flat) > limit else flat
    return None


def title_for(meta: dict, body: str, path: Path) -> str:
    if meta.get("title"):
        return str(meta["title"]).strip()
    heading = HEADING.search(body)
    if heading:
        return heading.group(1).strip()
    return ORDER_PREFIX.sub("", path.stem).replace("-", " ").title()


def published_at_for(meta: dict, path: Path) -> datetime:
    raw = meta.get("date") or meta.get("published")
    if isinstance(raw, datetime):
        return raw
    if raw is not None:
        try:
            return datetime.fromisoformat(str(raw).strip())
        except ValueError:
            pass
    # ponytail: mtime as the fallback date. Wrong only for files copied
    # without timestamps; pass a real date in frontmatter if it matters.
    return datetime.fromtimestamp(path.stat().st_mtime)


def collect(root: Path, skip: set[str]) -> list[Path]:
    return sorted(
        p
        for p in root.rglob("*.md")
        if not (p.parent == root and p.name in skip)
    )


def read_all(paths: list[Path], root: Path) -> list[dict]:
    """First pass: parse every file so wikilinks can resolve forwards."""
    parsed = []
    for path in paths:
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        parsed.append(
            {
                "path": path,
                "meta": meta,
                "body": body,
                "slug": slug_for(path, root),
                "keys": link_keys(path, root),
            }
        )
    return parsed


async def run(args: argparse.Namespace) -> int:
    root = Path(args.content_dir).resolve()
    if not root.is_dir():
        print(f"ERROR: not a directory: {root}")
        return 1

    files = collect(root, DEFAULT_SKIP)
    if not files:
        print(f"No markdown found under {root}")
        return 1

    parsed = read_all(files, root)
    targets = {key: item["slug"] for item in parsed for key in item["keys"]}

    dir_category = dict(pair.split("=", 1) for pair in args.map)

    async with async_session_factory() as session:
        owner = (await session.execute(select(Owner).limit(1))).scalar_one_or_none()
        if owner is None:
            print("ERROR: No owner found. Run seed_owner.py first.")
            return 1

        categories = {
            c.slug: c
            for c in (
                await session.execute(
                    select(Category).where(Category.owner_id == owner.id)
                )
            ).scalars()
        }
        if not categories:
            print("ERROR: No categories found. Run seed_data.py first.")
            return 1

        tags_by_slug = {
            t.slug: t
            for t in (
                await session.execute(select(Tag).where(Tag.owner_id == owner.id))
            ).scalars()
        }
        series_by_slug = {
            s.slug: s
            for s in (await session.execute(select(Series))).scalars()
        }

        status = "published" if args.publish else "draft"
        imported = skipped = 0

        for item in parsed:
            path, meta, slug = item["path"], item["meta"], item["slug"]
            rel = path.relative_to(root).as_posix()

            existing = (
                await session.execute(select(Post.id).where(Post.slug == slug))
            ).scalar_one_or_none()
            if existing:
                print(f"  = {rel} -> {slug} (exists, skipped)")
                skipped += 1
                continue

            parts = path.relative_to(root).parts
            top = parts[0] if len(parts) > 1 else ""
            category = categories.get(
                slugify(dir_category.get(top, args.category))
            )
            if category is None:
                print(f"  ! {rel}: no category '{dir_category.get(top, args.category)}'")
                skipped += 1
                continue

            # --- Series: series/<name>/… ---
            series = None
            if top == args.series_dir and len(parts) > 2:
                series_slug = slugify(parts[1])
                series = series_by_slug.get(series_slug)
                if series is None:
                    series = Series(
                        owner_id=owner.id,
                        title=parts[1].replace("-", " ").title(),
                        slug=series_slug,
                        status=status,
                    )
                    session.add(series)
                    await session.flush()
                    series_by_slug[series_slug] = series
                    print(f"  + series: {series.title}")

            body = rewrite_wikilinks(item["body"], targets)
            words = len(body.split())

            post = Post(
                owner_id=owner.id,
                title=title_for(meta, body, path),
                slug=slug,
                content=body.strip(),
                excerpt=excerpt_for(meta, body),
                category_id=category.id,
                status=status,
                reading_time_mins=max(1, round(words / 200)),
                series_id=series.id if series else None,
                series_order=order_for(path) if series else None,
                published_at=published_at_for(meta, path) if args.publish else None,
            )

            for name in meta.get("tags") or []:
                tag_slug = slugify(str(name))
                tag = tags_by_slug.get(tag_slug)
                if tag is None:
                    tag = Tag(owner_id=owner.id, name=str(name), slug=tag_slug)
                    session.add(tag)
                    await session.flush()
                    tags_by_slug[tag_slug] = tag
                post.tags.append(tag)

            session.add(post)
            imported += 1
            print(f"  + {rel} -> /posts/{slug}  [{category.name}]")

        if args.dry_run:
            await session.rollback()
            print(f"\nDry run — nothing written. {imported} would import, {skipped} skipped.")
        else:
            await session.commit()
            print(f"\nDone. {imported} imported as {status}, {skipped} skipped.")

    return 0


def self_check() -> int:
    """Parser/rewriter checks — the two places this script can quietly lie."""
    meta, body = parse_frontmatter(
        '---\ntitle: "A: B"\ndate: 2026-04-16\ntags: [x, y]\n---\nHello\n'
    )
    assert meta["title"] == "A: B", meta
    assert meta["tags"] == ["x", "y"], meta
    assert body.strip() == "Hello", repr(body)

    assert parse_frontmatter("No frontmatter\n") == ({}, "No frontmatter\n")
    # Not frontmatter: a --- rule further down the file must stay put.
    assert parse_frontmatter("text\n---\nmore\n")[1] == "text\n---\nmore\n"

    targets = {"projects/cloud-ide/backend": "backend", "backend": "backend"}
    assert (
        rewrite_wikilinks("see [[projects/cloud-ide/backend|the docs]]", targets)
        == "see [the docs](/posts/backend)"
    )
    assert rewrite_wikilinks("[[backend]]", targets) == "[backend](/posts/backend)"
    assert (
        rewrite_wikilinks("[[backend#setup|Setup]]", targets)
        == "[Setup](/posts/backend)"
    )
    # Unresolved degrades to its label, never to a dead link.
    assert rewrite_wikilinks("[[nope|Gone]]", targets) == "Gone"
    assert rewrite_wikilinks("[[nope]]", targets) == "nope"

    root = Path("/c")
    assert slug_for(root / "blog" / "02-gitops-vector.md", root) == "gitops-vector"
    assert slug_for(root / "projects" / "cloud-ide" / "index.md", root) == "cloud-ide"
    assert order_for(Path("02-intro.md")) == 2
    assert order_for(Path("intro.md")) is None
    assert link_keys(root / "a" / "b.md", root) == ["a/b", "b"]
    assert link_keys(root / "a" / "index.md", root) == ["a/index", "index", "a"]

    assert excerpt_for({"description": " D "}, "body") == "D"
    assert excerpt_for({}, "# Title\n\nFirst para.\n\nSecond.") == "First para."
    assert title_for({}, "## Heading here\n", Path("01-x.md")) == "Heading here"
    assert title_for({}, "no heading", Path("01-my-post.md")) == "My Post"
    assert published_at_for({"date": "2026-04-16"}, Path(__file__)).year == 2026

    print("self-check OK")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("content_dir", nargs="?", help="directory of .md files")
    parser.add_argument(
        "--category",
        default="Projects",
        help="category for files no --map rule matches (default: Projects)",
    )
    parser.add_argument(
        "--map",
        action="append",
        default=[],
        metavar="DIR=CATEGORY",
        help="per-top-level-directory category, e.g. --map blog=Thoughts",
    )
    parser.add_argument(
        "--series-dir",
        default="series",
        help="directory whose subfolders become Series (default: series)",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="import as published (default: draft, review in admin first)",
    )
    parser.add_argument("--dry-run", action="store_true", help="parse, print, roll back")
    parser.add_argument("--self-check", action="store_true", help="run asserts, exit")
    args = parser.parse_args()

    if args.self_check:
        sys.exit(self_check())
    if not args.content_dir:
        parser.error("content_dir is required (or pass --self-check)")
    sys.exit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
