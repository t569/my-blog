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
| `$$\int_0^1 f(x)\,dx$$` | display, centred on its own line |

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

### Display math still needs Markdown mode

`$$…$$` has no block-level equivalent yet, so BlockNote's
`blocksToMarkdownLossy()` would eat it. **Opening such a post in Rich mode is
enough to lose it on the next save** — you do not have to touch the formula.

The editor defends against this automatically: a post matching
`NEEDS_RAW_EDITOR` in `src/lib/math.ts` **opens in Markdown mode**, with the
reason shown under the mode toggle. The guard is at load, not at save, because
loading is where the damage happens.

The guard errs toward Markdown. A false positive costs you one editor mode; a
false negative costs you your formulas.

### Why formulas are extracted before the markdown parser runs

Non-obvious, and the reason `protectInlineMath()` exists: markdown escapes are a
subset of LaTeX syntax. `\{` is a valid markdown escape that parses to `{`, so
`$\{x\}$` handed straight to the parser comes back as `${x}$` with the LaTeX
already broken and nothing left to detect. Emphasis does the same to `$a*b*c$`.

So each formula is swapped for an opaque token *first*, the parser only ever
sees characters it has no rules for, and the tokens become math nodes
afterwards. All of it is asserted by:

```bash
cd frontend && npm run check:math
```

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
