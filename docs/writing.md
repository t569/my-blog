# Writing posts

The editor lives at `/admin/posts/new` (or `/admin/posts/<id>` to edit). Its
body has three modes, toggled from the right sidebar:

| Mode | What it is |
|---|---|
| **Rich** | BlockNote WYSIWYG. Handles inline math; loses display math — see below |
| **Markdown** | A plain textarea holding the actual stored content |
| **Preview** | Rendered through `MarkdownRenderer`, the same component the public page uses |

Preview is not an approximation. It is the identical component, so KaTeX,
themed code blocks and prose styling all resolve exactly as they will once
published. A draft is not served by `/posts/[slug]` — that route is
published-only — which is why preview happens in place rather than by opening
the post in a new tab.

## Math

KaTeX is wired into the renderer (`remark-math` → `rehype-katex`), so math works
in posts, in `/about`, and in Preview with nothing to switch on.

| Syntax | Renders as |
|---|---|
| `$x^2 + y^2 = r^2$` | inline, in the flow of the sentence |
| `` $`x^2`$ `` | inline — GitHub's form, works too |
| `$$` on their **own lines**, LaTeX between | display, centred |
| ```` ```math ```` fence | display — GitHub's form, works too |
| `$$a = b$$` all on one line | **inline**, not display |

That last row surprises people and is not a bug here: remark-math only opens a
math *block* when the `$$` is followed by a line ending. Put the fences on their
own lines and you get a centred equation; keep it on one line and you get inline
math with a two-character delimiter. Both were checked against the real plugin
chain rather than assumed.

The garden skin sets a serif body face specifically so inline formulas sit *in*
the line rather than on top of it — KaTeX typesets in a serif, and a sans body
makes every `$…$` look pasted in.

A display equation wider than the column scrolls inside itself
(`.katex-display { overflow-x: auto }` in `globals.css`) rather than pushing the
page sideways on a phone.

### `\(…\)` and `\[…\]` do not work

`remark-math` understands `$` and `$$` only. Those other delimiters reach the
page as literal backslashes. If you paste content from a renderer that used
them, convert to `$` — the editor will flag the post as containing math and open
it in Markdown mode, but that is the *guard* firing, not a promise it renders.

### Escape dollar amounts

Two prices in one paragraph are two delimiters:

```markdown
it costs $5 and $10 today     →  renders "5 and " as math
it costs \$5 and \$10 today   →  correct
```

This bites the rendered page, not just the editor. Backslash-escape any literal
`$` in prose.

## Inline math works in the rich editor

`$…$` is a real node in Rich mode. It renders through KaTeX as you write, you
can click it to edit the LaTeX, and `/math` in the slash menu inserts a new one.
Formulas survive the round-trip back to markdown unchanged.

There is no input rule, so typing `$x$` directly in Rich mode stays literal text
until the post is saved and reloaded. Use `/math`, or write in Markdown mode —
imported and saved content arrives already converted.

### Display math is a switch

Turn on **Display math in the editor** at `/admin/settings/features` and `$$`
blocks and ```` ```math ```` fences become centred equations you can click to
edit, with `/display math` in the slash menu. It is **off by default** — an
opt-in, because a bug on this path costs someone their formulas.

With it off, a post containing display math opens in Markdown mode instead, with
the reason shown under the mode toggle. Either way the published page renders
the equation; the switch only decides how you *edit* it.

Whatever no plugin can render — `\(` and `\[` — always forces Markdown mode. The
guard is at load, not at save, because loading is where the damage happens, and
it errs toward Markdown: a false positive costs one editor mode, a false
negative costs you your formulas.

### Why formulas never touch the markdown machinery

Non-obvious, and the reason `src/lib/math.ts` exists. Both directions damage
LaTeX, so a formula is swapped for an opaque token before either runs:

- **In.** Markdown escapes are a subset of LaTeX syntax. `\{` is a valid escape
  that parses to `{`, so `$\{x\}$` handed to the parser comes back as `${x}$`,
  already broken with nothing left to detect. Emphasis does the same to
  `$a*b*c$`.
- **Out.** Display math handed to the serialiser inside a `<p>` has its newlines
  collapsed *and* loses backslashes — `\end{aligned}` returns as
  `end{aligned}`. Inside a `<pre>` it survives but becomes a code fence.

**Order matters more than anything else here.** Display forms are tokenised
first; run the single-`$` pattern first and it pairs delimiters straight across
a `$$` block, turning `$$a$$ and $b$` into the formulas `a` and `" and "`.
`protect()` owns that ordering so no plugin can get it wrong.

All of it is asserted by:

```bash
cd frontend && npm run check:math
```

### Adding another delimiter family

`src/components/editor/plugins/` holds one file per plugin — a pattern, a node
and a renderer — plus `registry.ts`, which owns tokenising, the shared counter
and the ordering. A new plugin declares its patterns and `order`; it never mints
its own tokens, which is what stops two of them colliding.

Switching from Markdown back to Rich remounts BlockNote against the *current*
content rather than the version loaded at mount, so raw edits survive the
switch instead of being overwritten by BlockNote's first `onChange`.

## Importing existing markdown

`backend/scripts/import_markdown.py` takes any tree of markdown with YAML
frontmatter. It is generic — no assumptions about which static-site generator
wrote the files:

```bash
cd backend
uv run python -m scripts.import_markdown ../path/to/content --map blog=Thoughts --publish
```

- `series/<name>/NN-title.md` creates the series and takes `series_order` from
  the numeric filename prefix.
- `--map <dir>=<Category>` assigns categories by folder.
- `index.md` takes its parent folder's slug, so `projects/cloud-ide/index.md`
  becomes `/posts/cloud-ide` rather than a second `/index`.
- Wikilinks (`[[target]]`) are rewritten to markdown links in a second pass, so
  forward references resolve. Unresolved ones degrade to their label rather than
  to a dead link.
- Idempotent by slug — a partial run is just repeated.
- `--dry-run` parses and rolls back; `--self-check` runs the parser asserts with
  no database at all.

Imported content keeps its `$…$` as written, which is the other reason the math
guard matters.
