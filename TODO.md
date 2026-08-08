# Customization TODO — `dev/t569`

Migrating the Quartz digital garden at [t569.github.io/blog](https://t569.github.io/blog/)
onto this Next.js + FastAPI stack, and rebranding it.

Fork: `t569/my-blog` (origin) ← upstream `DejusDevspace/my-blog`

## Ground rules

1. **The blog is mine** — name, links, favicon, styling all become mine.
2. **Credit stays with the original author.** No rewriting his comment headers,
   docs, or module names just to stamp my name on them.
3. **An upstream merge must not break his site.** Every brand value falls back
   to the d3jusdevspace default in code; my values live in `.env.local`
   (gitignored). So the diff upstream sees contains *none* of my branding.

---

## Done

- [x] Branch `dev/t569` created and pushed to the fork
- [x] Remotes wired: `origin` = fork, `upstream` = original
- [x] **Rename** — every brand string routed through `SITE` in
      `frontend/src/lib/constants.ts`, each one env-overridable:

      name · tagline · description · url · motto · repo · github · twitter · linkedin

      My values: `frontend/.env.local` (gitignored — set the same vars on the
      host when deploying, `NEXT_PUBLIC_*` is inlined at build time).
  - Page metadata no longer repeats the site name; the root layout's
    `title.template` (`"%s — {name}"`) appends it.
  - Deleted `STORAGE_KEYS` (dead code, never imported).
  - Footer hides the LinkedIn link when the var is blank, so a fork without one
    doesn't render a dead link.
- [x] **Favicon** — the Kerbal astronaut from the Quartz garden, now at
      `public/icon-kerbal.png`, selected by `NEXT_PUBLIC_SITE_ICON`.
      Both icons moved out of `src/app/` into `public/` and are pointed at
      through `metadata.icons`, because the `app/icon.*` file convention
      resolves from the filesystem at build time — it can't be gitignored (CI
      builds from a clean clone) and can't be overridden per-fork. It also
      emitted *two* `<link rel="icon">` tags and let the browser pick. Now
      exactly one, and upstream's default is still his `/favicon.ico`.
- [x] **Skins** — a look is now a file in `src/styles/themes/`, selected by
      `NEXT_PUBLIC_SITE_SKIN` → `data-skin` on `<html>`, independent of the
      light/dark toggle:
  - `cyber-luxury.css` — upstream's original palette **verbatim**, and the
    `:root` fallback. Still fully working; set the env var back to switch.
  - `garden.css` — mine (deep space / paper).

      Adding a look never edits an existing one. `globals.css` holds structure
      only. Theme names stayed `dark`/`light` so the navbar toggle and
      BlockNote's `resolvedTheme` keep working untouched. Light/dark carries
      over from the Quartz garden for free.
- [x] **Typography** (garden skin) — Schibsted Grotesk headings, Source Serif 4
      body, IBM Plex Mono code. Serif body is deliberate: KaTeX typesets math
      in a serif face, so inline formulas sit *in* the line rather than on top
      of it. cyber-luxury keeps Space Grotesk / JetBrains Mono / Montserrat.
- [x] **Code blocks follow the theme** — dropped the hardcoded `atom-one-dark`
      import from `MarkdownRenderer.tsx` (it kept code dark in light mode) and
      mapped `.hljs-*` onto per-skin `--syn-*` tokens in `globals.css`.
- [x] Type-checks clean, `npm run build` passes, single favicon link verified
      in the built HTML
- [x] **Backend boots on one credential** — `DATABASE_URL` is the only required
      value; the other five degrade instead of blocking startup:
  - `NEXTAUTH_SECRET` unset → admin API returns 401 for everyone. **Fail
    closed**: an empty secret would make `jwt.decode` verify against an empty
    HMAC key, so anyone could mint an admin token. Unset means shut, not open.
  - `CLOUDINARY_*` unset → `upload_image` / `delete_image` return 503.
  - `GROQ_API_KEY` unset, or `AGENT_ENABLED=false` → the agent never runs.
    Two separate controls on purpose, so the agent can be switched off without
    deleting credentials.
  - `settings.agent_ready` / `settings.cloudinary_ready` are the single source
    of truth; guards sit at the two choke points (`start_scheduler`, which
    covers both startup and `reschedule()`, and the manual trigger route), so
    all four `AsyncGroq` node call sites stayed untouched.
  - Check: `python -m scripts.check_optional_credentials` from `backend/`.
  - Generic, no personal strings — **PR-able upstream** off a clean
    `upstream/main` branch.
- [x] **`AUTHOR_PERSONA`** — the agent's ghostwriting framing moved out of the
      topic/writer prompts into config, defaulting to upstream's author.
- [x] **Feature switches** at `/admin/settings/features` — the optional halves
      are now switchable at runtime, not only by editing the environment.
      Credentials say what the deployment *can* do (`available`, env, fixed at
      deploy); the switch says what it *should* (`enabled`, `owners.features`
      JSONB). A feature runs only when both hold, so an unavailable one shows
      what to set instead of an off switch that can't be turned on — and keeps
      its position, so adding the credential later restores the choice.
      **Dependent parts are one switch.** The agent's schedule, manual trigger
      and draft generation all die with the LLM key, so they're a single entry
      whose card lists what goes with it; three switches would let the UI ask
      for states the backend can't honour. It holds at runtime too — switching
      the agent off removes the cron job immediately instead of leaving it
      firing until the next restart, and the Agent Settings page reads the same
      flag and disables its own controls.
      Registry lives server-side only, so page and backend can't drift. Missing
      key = on, so upstream behaviour is unchanged; `AGENT_ENABLED=false` still
      outranks the switch, asserted in `check_optional_credentials`.
      Generic, no personal strings — **PR-able upstream**.

### Fixed along the way — generic bugs, all PR-able upstream

- [x] **"Preview Post" did nothing.** The button had no `onClick` at all. It
      toggles the editor body to a `MarkdownRenderer` of the current content,
      in place — a draft isn't served by `/posts/[slug]` (published-only), so
      linking out would 404 for exactly the case preview exists for. Previewing
      through the same component as the public page means KaTeX, themed code
      blocks and prose styling come for free.
- [x] **The slug hint in the editor hardcoded the upstream deployment URL.**
      Reads `SITE.url` now.

- [x] **Hydration mismatch on the home feed.** `PersistQueryClientProvider`
      restores the localStorage cache on the client, and during that restore
      react-query reports `isLoading: false` (it is `isPending && isFetching`,
      and fetching is suspended while restoring) while the server rendered
      `isLoading: true`. The skeleton-vs-content branch therefore disagreed on
      the hydration render. `isLoading` → `isPending` in `HomeFeedClient` and
      `PostComments` — `isPending` means "no data yet" and is identical on both
      sides. The `/admin` pages share the pattern but are auth-gated and were
      left alone.
- [x] **`.prose h1` had no `font-size`.** Tailwind's preflight resets headings to
      `inherit` and `globals.css` only sized `h2`/`h3`, so a markdown `# Title`
      rendered *smaller* than the `##` beneath it, in every post.
- [x] **`LOCAL_POSTGRES_DOCKER_FOR_DEV` had to be declared in `app/config.py`.**
      Pydantic `Settings` forbids unknown keys, so an undeclared entry in `.env`
      is a hard boot failure rather than a warning — which it duly was. The three
      `DEV_DB_*` overrides are declared too, otherwise the commented-out lines in
      `.env.example` were a trap for whoever uncommented them.

### Kept deliberately un-renamed (rule 2)
Comment headers (`d3jusdevspace — API Proxy Route` etc.), `docs/*`, the backend
package `app/devspace_agents/`, and the react-query cache key. Renaming these
would be pure merge-conflict fodder with zero user-visible benefit.

---

## Next

### 1. Styling — theme abstraction, then a look of my own

**Current state:** `frontend/src/app/globals.css`, 645 lines, already fully
token-driven — `:root` (dark) and `[data-theme="light"]`. `next-themes` runs
with `attribute="data-theme"`. So swappable themes are mostly a matter of
*using* what's there, not building new machinery.

- [x] ~~Split tokens into skin files~~ — done
- [x] ~~Recolor to the garden direction~~ — done
- [x] ~~Fix theme-ignoring code blocks~~ — done
- [x] **Seen in a browser** — the full matrix, driven over CDP: `/`, `/about`
      and `/series` × {garden, cyber-luxury} × {dark, light}. Both skins and both
      modes resolve their own tokens (garden → Source Serif 4, `#58a6ff` /
      `#284b63`; cyber-luxury → Space Grotesk, `#00e5ff` / `#0066ff`), and no
      combination overflows horizontally.
      Both skins are always present in `globals.css` and selected by `data-skin`,
      so the whole matrix is reachable by flipping the attribute at runtime — no
      rebuild, no env change. That's the skin split paying for itself.
      **Upstream's cyber-luxury is intact and still looks the way he built it**,
      which is rule 3 holding in practice rather than in principle.
- [x] **Sweep hardcoded colors that ignore the skin.** 11 spots, all admin, all
      cyber-luxury's *old* palette frozen into arbitrary values — `#00ff88`,
      `#ffcc00`, `rgba(0,229,255,…)` glows. They didn't even match the skin any
      more (`--color-success` is `#1d9e75` now). Now `text-success`,
      `bg-warning-muted`, `shadow-neon` etc., which also makes the neon
      constraint below resolve for free: garden-light sets
      `--shadow-neon-accent: none`, so the glow disappears on paper instead of
      turning into a grey smudge.
      Left alone deliberately — neutral by design, not palette leakage: modal
      scrims (`bg-black/60`), dropdown shadows (`shadow-black/50`), the toggle
      knob (`bg-white`), and the CRT scanline overlays on the 404 and the
      loading spinner. If the paper skin ever wants a warm scrim, that's a
      `--color-overlay` token then, not now.
- [ ] **Signature element: the constellation.** Faint connecting lines between
      related posts and tags — earning back some of what the Quartz graph view
      did. Deferred deliberately; this is a feature, not a palette.
- [x] ~~**Constraint:** the neon glow must resolve to `none` on paper, not to a
      different colour~~ — held. Every glow now goes through
      `--shadow-neon-accent`, and garden-light sets it to `none`.

**Design direction** — blending my Quartz garden with the reference sites:

| Source | What to take |
|---|---|
| My Quartz theme | Deep-space dark mode: bg `#05050a`, node blue `#58a6ff`, constellation lines. Fonts: Schibsted Grotesk / Source Sans Pro / IBM Plex Mono |
| [fractalkitty.com](https://www.fractalkitty.com/) | Light, roomy, **image-first cards** — every post leads with a visual. Muted teal/peach/blue on white. Playful, artist-meets-mathematician; math shown as *pictures* (colored tables, grids, pentominoes) not just equations |
| [mathsedideas](https://mathsedideas.blogspot.com/p/problems.html) | Ruthless content-first minimalism. High contrast, thumbnail-led problem cards, heavy tagging, alphabetical + chronological browse |

Common thread in both references: **light background, generous whitespace,
visual-first.** That's the opposite of this stack's dark cyber-luxury default —
hence doing the theme split *before* restyling, so both can coexist.

- [x] **A "paper" light theme as the default for reading**, keeping deep-space
      as the alternate. `NEXT_PUBLIC_SITE_THEME` picks the starting mode,
      defaulting to `system` — upstream's behaviour, unchanged. `enableSystem`
      is switched off when a theme is pinned, because next-themes resolves
      `system` over any `defaultTheme` while that flag is on. The toggle still
      overrides and is remembered, so pinning never makes a mode unreachable.
      Verified in the built bundle: `skin:"garden",theme:"light"` is inlined.
- [ ] Post cards get a cover-image slot (both references lead with visuals)

### 2. Math notation (KaTeX)
My Quartz already runs `Plugin.Latex({ renderEngine: "katex" })`, so existing
math renders identically with the same engine.

- [x] `npm i remark-math rehype-katex katex`
- [x] `frontend/src/components/blog/MarkdownRenderer.tsx` — `remarkMath` in
      `remarkPlugins`, `rehypeKatex` in `rehypePlugins`, `katex/dist/katex.min.css`
      imported. 4 lines, no personal strings — **PR-able upstream**.
- [x] ~~KaTeX colour token pass~~ — not needed. `katex.min.css` contains exactly
      one colour declaration, `color: currentColor`, so formulas inherit the
      theme already. Only addition: `.katex-display { overflow-x: auto }` in
      `globals.css`, so a display equation wider than the column scrolls itself
      instead of pushing the page sideways on mobile.
      Verified in the built CSS (`.next/static/chunks/*.css`), 60 KaTeX font
      files emitted.
- [x] ~~**Editor hazard:** `blocksToMarkdownLossy()` mangles `$$…$$`~~ — the
      editor body now has three modes (Rich / Markdown / Preview), and a post
      containing display math or `\(` `\[` **opens in Markdown**, with the
      reason stated in the sidebar. Opening and saving was enough to lose the
      LaTeX, so the guard is at load, not at save. Bare inline `$x$` is
      deliberately not detected — "$5 and $10" matches it, and a false positive
      downgrades the editor for a post with no math. Switching back to Rich
      remounts BlockNote with `data.content`, not `initialData.content`, so raw
      edits survive instead of being overwritten by its first `onChange`.
      No custom BlockNote LaTeX block — a textarea was the whole fix.

### 3. Content migration
Content lives in **Postgres** here, not files — so this is an import script,
not a file copy. 11 markdown files in `t569/blog` under `content/`.

| Quartz | Here |
|---|---|
| `content/blog/*.md` | Post |
| `content/series/cloud-ide/*.md` | Series + Posts |
| `content/projects/cloud-ide/*.md` | Posts (or a Projects category) |
| frontmatter `tags:` | Tag |
| frontmatter `title`/`date`/`description` | title / published_at / excerpt |
| `content/about.md` | needs a static `/about` route — it's a page, not a post |

- [x] **Import script** — `backend/scripts/import_markdown.py`. Generic: any
      tree of markdown with YAML frontmatter, no Quartz specifics, no personal
      strings — **PR-able upstream**.
      `series/<name>/NN-title.md` creates the Series and takes `series_order`
      from the filename prefix; `--map <dir>=<Category>` assigns categories;
      `index.md` takes its parent folder's slug, so
      `projects/cloud-ide/index.md` is `/posts/cloud-ide` and not a second
      `/index`. Idempotent by slug, so a partial run is just repeated.
      `--dry-run` parses and rolls back, `--self-check` runs the parser and
      rewriter asserts with no database at all, `--publish` opts out of
      importing as drafts.
- [x] **Wikilinks** — rewritten to normal markdown links in a second pass, so
      forward references resolve. Unresolved ones degrade to their label rather
      than to a dead href.
- [x] Ran it: 9 posts, the `cloud-ide` series detected, tags created from
      frontmatter, **zero `[[` left** in the imported content. The four
      root-level garden pages (`index`, `about`, `admin`, `cloud-search`) are
      skipped as furniture; nested `index.md` files are real content.
      The series lands as **"Cloud Ide"** — the folder name title-cased. Rename
      it in admin; teaching the script about acronyms isn't worth it.
      This run went into the local container. The Neon database needs its own
      run once `DATABASE_URL` points there.
- [x] `Obrike-Oghenekome-Timothy-Resume.pdf` → `frontend/public/`. Committed
      rather than gitignored like `about.md`: a clean CI build would 404 on the
      link otherwise. The cost is that an upstream merge inherits one unused
      file.

### 4. `/about` page
- [x] Static route at `frontend/src/app/(public)/about/page.tsx`. Reads
      `frontend/content/about.md` off disk at build time and renders it through
      the existing `MarkdownRenderer` — so it gets KaTeX, themed code blocks and
      prose styling for free, and the DB isn't involved (it's a page, not a
      post).
      `content/about.md` is **optional**: it's the one thing that can't have a
      shared default, being by definition somebody's own words. Absent, the page
      falls back to `SITE.intro`, so upstream builds a real /about rather than a
      404. Nav link added (desktop + mobile panel).
      It started out gitignored; now committed, because Vercel builds from a
      clean clone and a gitignored file means the deployed page silently serves
      the fallback. The words are published either way — the fallback is what
      keeps the *code* forkable, not the file's absence from git.
- [x] **Designed, with motion.** `about.module.css` (scoped to the route, purely
      additive). One hairline carries the page: horizontal under the headline it
      is an *axis* ticked with the four things in the hero line; at the left
      margin it turns and descends as the article's spine, where the same stroke
      reads as a *taproot* with a node per section.
      All CSS, no library: staggered keyframes for the load sequence,
      `animation-timeline: scroll()` for the rail, `view()` for section reveals
      and for waking each node. Behind `@supports`, so Firefox (no scroll-driven
      animations yet) gets the finished state rather than a blank page.
      `prefers-reduced-motion` resolves everything to its end state — no motion
      at all, not a slower version. Every colour is a theme token, so both skins
      and both modes come along for free.
      The file's own structure drives it: the first `---` splits hero from body,
      and the `·`-separated line in the hero becomes the axis ticks. A `---` and
      a middot rather than frontmatter — no parser, and the file stays ordinary
      markdown that still reads correctly in Quartz or any other viewer. Without
      them the page silently drops the axis and renders as plain prose, which is
      what the upstream fallback does.
- [x] HTML comments no longer print as text — `react-markdown` skips raw HTML
      elements but emits comments verbatim. Stripped in `MarkdownRenderer`, so
      imported content with authoring notes is safe too. Generic, PR-able.
- [x] **The figure — a Klein bottle, sectioned by scroll.**
      `KleinFigure.tsx`: the figure-8 immersion, wireframed as rings crossed by
      longitudes, with the ring at the current scroll position lit and a mono
      readout of `u`. Sticky in the right margin while you read; below 78rem
      there's no margin to live in, so it drops back into the flow at the end of
      the article; below 40rem it's hidden.
      It shares the rail's timeline rather than introducing a second one — the
      figure is a readout of the mechanism already on the page. Sections change
      shape but never point count, which is what lets CSS `d` interpolate them;
      the whole thing is generated at build time, so nothing ships but path
      strings. Half a turn of the traverse mirrors the section — the
      non-orientability, shown.
      Three bugs worth remembering, all caught by checking rather than assuming:
  - **CSS Modules hash `@keyframes` names *and* the `animation` names that
    reference them.** A module rule saying `animation: klein-section` compiled
    to `animation: about-module__hash__klein-section`, which never matched the
    unhashed keyframes in the generated `<style>` — the morph silently did
    nothing while looking plausible. Scroll-driven rules now live in the
    generated global block, hooked on `[data-klein]` attributes.
  - **`@property … inherits: false` doesn't reach `::after`.** The readout's
    `counter-reset` was on the pseudo-element, so it read the initial `0`
    forever. Moved onto the animated element, whose counter scope reaches it.
  - **Two longitudes were the same curve.** `v = 0` and `v = π` both sit at the
    figure-eight's crossing point; the duplicate React key gave it away.
- [x] **The surface fills in behind the sweep**, translucent (9%) so the
      wireframe still reads through it and the tube passing through itself shows
      as a darker overlap. 20 bands, each revealed over its own slice of the
      scroll.
      A band has to be tiled as quads inside one path, *not* drawn as a single
      polygon around both rings: a ring is a figure-eight, so that polygon
      crosses itself and the nonzero fill rule carves it into petals. Subpaths
      of one `d` still fill exactly once, so no seams and no double-darkening
      within a band. (The 1-decimal rounding this originally used is gone — see
      the next entry; it was 2.3px, not the ~1px claimed here, and it showed.)
      Gaps in the filled surface are correct, not a bug: the figure-8 immersion
      is a twisted *band*, so where it turns edge-on to the view it projects to
      nothing.
      Levers if the weight ever matters, cheapest first: `PATCHES` /
      `PATCH_SAMPLES`, then `STOPS`, then drop the fill entirely (→ ~21KB).
- [x] **Made it read as an object.** It was a flat tangle: every stroke the same
      weight and opacity, near side and far, painted in parameter order.
      Now one idea does the work — `depth = x·sin(YAW) + y·cos(YAW)`, the
      into-screen component the projection already computes. For a ring that
      closes to `R·sin(u + YAW)`. It drives three things: paint order (sorted
      far → near, so a near band's wash covers the lines behind it), opacity
      (wireframe 0.38 near → 0.10 far, fill 0.13 → 0.05) and stroke weight.
      Longitudes span every depth, so each is cut into 8 arcs that shade
      individually. Rings 10 → 14, longitudes 6 → 4 and kept lighter — rings are
      the structure, longitudes only describe the flow. Figure 11rem → 13rem
      (breakpoint 75 → 78rem to match), caption now `KLEIN BOTTLE · FIGURE-8`.
      **Coordinates are integers at SCALE = 100, with relative `l` commands.**
      Two failed attempts got there: at SCALE 1 with two decimals the data cost
      40KB, and at SCALE 10 with integers a unit is 2.3px — that is not
      "sub-pixel", it is the blockiness, and it hit the wireframe as well as the
      bands. Relative commands are what makes full precision affordable:
      successive samples are ~14 units apart, so every point after the first is
      a two-digit delta rather than a four-digit absolute. No drift, because
      deltas are differences between already-rounded positions.
      Net: **30.9KB gzipped, level with the 30.3KB before this pass**, while
      carrying 43% more bands, 40% more rings, per-element depth shading and 10×
      the precision.
  - **The one that nearly shipped:** renaming the coordinate rounder to integer
    `Math.round` silently sent *opacities* through it too, so every
    `opacity="0.24"` became `opacity="0"` and the entire wireframe vanished
    while the build stayed green. The helper is now `coord()`, with `dp2()` for
    everything that isn't geometry. Caught by looking at the screenshot.
- [x] **OPEN QUESTIONS section** — transformers, neural network theory, and
      moving definitions between fields, written question-shaped rather than as
      claims, with `<!-- -->` notes marking what's his to sharpen. Fourth node
      on the rail.
      Note the hero axis still reads compilers · CPU schedulers · cloud
      sandboxes · theoretical physics and mentions none of this; changing the
      `·` line in `about.md` is all it takes if the axis should say so too.
- [ ] Replace the draft prose in `frontend/content/about.md` with the real
      thing. It's scaffolded from the intro and the four domains, with `<!-- -->`
      notes marking what's yours to write. Content changes need a rebuild;
      that's the deal with build-time reads.
- [x] Checked in dark and in cyber-luxury — see the matrix under §1. The figure
      is fully token-driven, so it follows: cyan hairlines and the neon glow back
      on the rail nodes under cyber-luxury dark, slate on paper under garden
      light. Chrome's CLI won't emulate `prefers-color-scheme`, but
      `Emulation.setEmulatedMedia` over CDP will, and `data-theme` / `data-skin`
      can simply be set directly.
      One observation, not yet acted on: at its real 208px the figure is fainter
      than it looks in a magnified crop — the near-side wireframe at 0.38 with a
      0.35px stroke gives a lot back to antialiasing. Nudging the depth-opacity
      range up would fix it; deliberately left alone because "instrument, not
      hero" is the whole brief.

---

### 5. Database — decide *after* using it, not before

Considered swapping Postgres for SQLite (`sqlite-vec` + FTS5) to cut hosting and
credentials. Deferred, for three reasons:

- It doesn't remove the dependency that costs anything. Embeddings come from
  HuggingFace wherever the vector is stored.
- It's the most merge-hostile change available. Everything else here is
  additive and env-driven; divergent migration history is the one thing with no
  `??` upstream default. Three migrations, two `Vector(384)` columns and
  ~250 lines of `search_service.py` using raw `ts_rank` / `<=>` would fork
  permanently.
- SQLite needs a durable filesystem — no serverless host. Trades hosted
  Postgres for hosted SQLite (Turso/LiteFS) or a VM with a volume.

**The real question is whether semantic search is wanted at all.** With 11
notes, keyword search is better — you know what you wrote; embeddings earn
their keep at hundreds of documents. Drop the vector half and the expensive
half of the migration disappears: no HuggingFace, no pgvector, and FTS5 makes
it tractable. Revisit once the site has been used for a while and it's clear
whether search ever gets reached for. (`sqlite-vec` moves fast — check its
current state then rather than trusting notes from now.)

- [x] Get a connection string, run it, use it — local `pgvector/pgvector:pg16`
      container (`my-blog-pg`), started by `backend/scripts/dev_db.sh`:
      running → say so, stopped → start, absent → create, then wait for
      `pg_isready` so a following `alembic upgrade head` can't race it. Gated on
      `LOCAL_POSTGRES_DOCKER_FOR_DEV=true` in `backend/.env` (default false —
      with `DATABASE_URL` on Neon, a script that starts containers is a
      surprise). Details in [docs/local-development.md](./docs/local-development.md).
      Schema and seeds are in: `alembic upgrade head` (7 migrations, the
      pgvector one runs `CREATE EXTENSION IF NOT EXISTS vector`), then
      `seed_owner` and `seed_data`, then the content import.
- [ ] **Point `DATABASE_URL` at Neon and re-run the same three steps.**
      `neonctl init` is not needed — that scaffolds a *new* project; a
      connection string is enough. Two details it will fail on otherwise: the
      URL needs the `postgresql+asyncpg://` scheme, and `?ssl=require`, *not*
      `?sslmode=require` — asyncpg rejects `sslmode` as an unknown kwarg. Set
      `LOCAL_POSTGRES_DOCKER_FOR_DEV=false` once off the container.
- [ ] Only then: keep pgvector, or drop semantic search and reconsider

---

### 6. Hosting — free tier, three services

Written up in [docs/deployment.md](./docs/deployment.md): Vercel → Render →
Neon, the env tables for each, and a first-deploy checklist.

- [x] **Scheduled agent runs survive a sleeping backend.** Render's free
      instance spins down after ~15 min, and the scheduler is APScheduler
      *inside* that process — so it fires nothing, silently. The timing moved to
      Vercel Cron (`/api/cron/agent`), the work stayed put: the route mints the
      same admin JWT the browser session uses and calls the existing
      `/admin/agent/trigger`. No pipeline logic, no second auth scheme, and the
      agent feature switch still governs it. Fails closed — no `CRON_SECRET`,
      no runs, because the URL is public.
      Turn **Schedule active** off on `/admin/settings/agent` so an always-on
      host later doesn't run both and produce two drafts.
- [x] **`frontend/.env.example`** — every var the frontend reads, each with
      upstream's default, so a deploy has a checklist instead of guesswork.
      Generic — **PR-able upstream**.
- [ ] Actually deploy: Neon is seeded and holds the 9 imported posts, so it's
      Render + Vercel and the checklist.
- [ ] Custom domain, once there's something worth pointing it at.

---

## Explicitly skipped

- **Graph view** — Quartz's signature feature, no equivalent here. Real project,
  not a config change. Revisit only if I actually miss it.
- **Backend package rename** (`app/devspace_agents/`) — see rule 2.
