# Working rules for this repo

This is a **fork** of [DejusDevspace/my-blog](https://github.com/DejusDevspace/my-blog).
`origin` = `t569/my-blog`, `upstream` = the original.

## Core philosophy: extend by preserving, never by replacing

Every customization must leave the thing it customizes intact and selectable.
A change that makes the original behaviour unreachable is a bug, even when the
new behaviour is better.

Three obligations, all at once:

1. **This is my blog.** My name, links, favicon, and visual identity.
2. **Credit stays with the original author.** Don't rewrite his comment
   headers, docs, or module names to stamp my name on them.
3. **An upstream merge must break nothing.** If he merges this fork, his site
   should look and read exactly as it did.

### How that is achieved here

**Defaults are upstream's; overrides are mine and live outside git.**
Every brand value in `frontend/src/lib/constants.ts` reads
`process.env.NEXT_PUBLIC_SITE_* ?? "<upstream default>"`. My values sit in
`frontend/.env.local`, which is gitignored — so my branding never appears in a
diff, and the code he'd merge still describes his site.

**Additions sit beside originals, never on top of them.**
`src/styles/themes/cyber-luxury.css` holds his original palette verbatim and is
the `:root` fallback. `garden.css` is mine. Adding a look never edits an
existing one. Same rule for the favicon: his `favicon.ico` stayed, mine was
added alongside, and `metadata.icons` chooses.

**Prefer a seam over a rewrite.**
When something is hardcoded in many places, route it through one variable
rather than find-and-replacing it everywhere. Fewer conflict points, and the
next fork gets the seam for free.

### Shared features vs. personalisation

Yes, both can grow at once — the split is what makes it work. Before building,
decide which kind of change this is:

| | Feature (shared) | Personalisation (mine) |
|---|---|---|
| Test | Would upstream want it? | Is it my name/face/taste? |
| Examples | KaTeX math, markdown import script, theme-aware code blocks, the constellation component, a raw-markdown editor toggle | `.env.local` values, `garden.css`, the Kerbal icon, my bio |
| Lives in | Normal code, generic, no personal strings | Env vars and additive files only |
| Committed? | Yes | Env values never; additive files only when a clean CI build needs them (`content/about.md`, the Kerbal icon) |
| Goes upstream | Yes — branch off `upstream/main`, PR it | Never |

Anything with a personal string baked in is not a feature yet. Extract the
string to `SITE`/settings with upstream's value as the default, and it becomes
one. That is the same move as everything else in this file — the seam is what
makes a change shareable *and* personal at the same time.

Workflow for a shared feature:

```bash
git fetch upstream
git checkout -b feat/<name> upstream/main   # clean base, no fork branding
# build it generically
git push origin feat/<name>                 # PR from here to upstream
git checkout dev/t569 && git merge feat/<name>
```

### Anti-patterns — these have already been made once

- **Blanket find-replace of the original author's name.** Touched 11 files
  purely to rewrite comment headers. Pure merge-conflict fodder, zero
  user-visible benefit, and it erased attribution. Reverted.
- **Overwriting a palette instead of adding one.** The original theme stopped
  existing and became unswitchable. Restructured into skins.
- **Deleting his asset to install mine** (`favicon.ico`). Restored.
- **Committing a reformatted `package-lock.json`.** `npm install` rewrote all
  20k lines; that is not a change, it's a conflict. Revert it unless
  dependencies actually changed. Cause: npm re-indents the lockfile to match
  `package.json`, which uses tabs, while upstream's lockfile is 2-space. After
  any install, squash it back:
  `node -e "const fs=require('fs'),f='package-lock.json';fs.writeFileSync(f,JSON.stringify(JSON.parse(fs.readFileSync(f,'utf8')),null,2)+'\n')"`
  — a 3-dependency install then shows ~170 added lines, not 20k changed ones.

## Gotchas worth remembering

- `@theme inline` in Tailwind v4 bakes literal values into utilities
  (`.font-body{font-family:"Space Grotesk"…}`), so a runtime override of
  `--font-body` does nothing. Point the theme var at another var
  (`--font-body: var(--font-body-family)`) to keep utilities overridable.
- Next.js `app/icon.*` and `app/favicon.ico` are **filesystem conventions
  resolved at build time**. They cannot be gitignored (CI builds from a clean
  clone — the file wouldn't exist) and cannot be overridden per-fork. Put icons
  in `public/` and point at them via `metadata.icons`. Having both an
  `app/favicon.ico` and an `app/icon.png` emits two `<link rel="icon">` tags
  and lets the browser pick.
- `NEXT_PUBLIC_*` is inlined at **build** time — restart dev after editing
  `.env.local`, and set the same vars on the host for deploys. On Vercel a
  changed value needs a *redeploy*, and that is the platform's model, not the
  prefix's: deployments are immutable, so runtime-read env would behave the
  same. `frontend/.env.example` is the checklist of what a host must set.
- Don't rename theme names (`dark`/`light`) casually — `next-themes`, the
  navbar toggle, and BlockNote's `resolvedTheme` all key off them.

## Verify before claiming done

`npx tsc --noEmit` and `npm run build`, from `frontend/`. For anything that
changes rendered output, grep the built CSS/HTML in `.next/` rather than
assuming — that is how the double-favicon and the `@theme inline` problems were
both caught.

Progress and remaining work: [TODO.md](./TODO.md).
