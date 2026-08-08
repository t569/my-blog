# Deployment

Getting this online for **£0**: Vercel (frontend) → Render (backend) → Neon
(database). All three have a free tier that fits this stack, and each one has
exactly one behaviour that will surprise you. Those are the interesting parts of
this document; the clicking is not.

## TL;DR

```bash
# 1. Seed the database — once, from your machine, backend/.env pointing at Neon
cd backend
uv run python -m scripts.seed_owner
uv run python -m scripts.seed_data

# 2. Backend  → Render:  root dir `backend`, Docker, health check /health
# 3. Frontend → Vercel:  root dir `frontend`, paste .env.local into the env UI

# 4. Prove it
curl https://<render-app>.onrender.com/health
```

Migrations are not in that list: the backend container runs `alembic upgrade
head` before it serves, so a push carries its own schema change. See
["Migrations ride along with the deploy"](#migrations-ride-along-with-the-deploy).

---

## Topology

```
   browser ──▶ Vercel (Next.js)  ──▶ Render (FastAPI)  ──▶ Neon (Postgres)
               │                     │
               │ /api/proxy/*        │ APScheduler (see "The instance sleeps")
               │ /api/cron/agent ────┘
```

The browser never talks to Render. Every API call goes through the Next.js
route at `src/app/api/proxy/[...path]/route.ts`, which forwards
`/api/proxy/*` to `${BACKEND_URL}/api/v1/*` **server-side**. Two consequences
worth knowing:

- The backend URL is not public, and CORS never enters the picture in normal
  operation. `CORS_ORIGINS` still matters if anything ever calls Render
  directly (a webhook, `curl`, the `/docs` page).
- A backend hiccup surfaces as a 502 from *your* domain, so look in the Vercel
  function log first, then Render's.

---

## 1. Neon (database)

Free tier: 0.5 GB, one project, compute that auto-suspends when idle and wakes
in well under a second. Nothing here needs tuning.

**Paste the connection string exactly as Neon gives it to you.** No hand-editing:

```
DATABASE_URL=postgresql://user:pw@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

`normalize_database_url()` in `backend/app/config.py` rewrites the scheme to
`postgresql+asyncpg://`, renames `sslmode` to asyncpg's `ssl`, and drops
`channel_binding` (libpq understands it, asyncpg raises `TypeError` on it).
Switching Postgres hosts is this one value and nothing else.

### Migrations ride along with the deploy

Render's free instances have no pre-deploy hook and no shell, so there is no
*separate* step on the host to run Alembic from. The container's start command
is that step instead — `backend/Dockerfile` ends with:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

So the schema is brought to head before anything is served, and a commit
containing a migration deploys itself. If the migration fails the container
never starts, the health check fails, and the previous version stays up —
failing closed, the same way an unset credential here disables a feature rather
than opening it.

The cost of putting it there rather than in a pre-deploy hook: it also runs on
every wake from sleep, not only on deploy. At head that is one `SELECT` against
`alembic_version`, which is cheap but not free on an instance that already
takes ~15s to wake. `preDeployCommand` in `render.yaml` is the upgrade path,
and it needs a paid instance type.

The seeds are still manual, because they are one-time fixtures rather than
something a push invalidates. Both are idempotent, so re-running is safe:

```bash
cd backend            # with .env pointing at Neon
uv run python -m scripts.seed_owner    # creates the owner row from ADMIN_EMAIL
uv run python -m scripts.seed_data     # categories and tags
```

Content comes in the same way, from wherever the markdown lives:

```bash
uv run python -m scripts.import_markdown ../path/to/content --map blog=Thoughts --publish
```

---

## 2. Render (backend)

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Docker (the `Dockerfile` is already `$PORT`-aware) |
| Health check path | `/health` |
| Instance type | Free |

Environment:

| Variable | Needed? | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | The only value the app cannot boot without |
| `NEXTAUTH_SECRET` | For admin | Must be byte-identical to Vercel's, or every admin call is a 401. Unset = admin API closed to everyone |
| `ADMIN_EMAIL` | For admin | Must match Vercel's — it is the JWT claim the backend resolves to the owner row |
| `CORS_ORIGINS` | Recommended | `https://<your-domain>` |
| `ENVIRONMENT` | Optional | `production` |
| `GROQ_API_KEY` | Optional | The agent |
| `AGENT_ENABLED` | Optional | Deploy-level kill switch, defaults true |
| `CLOUDINARY_*` | Optional | All three or none — a partial set is not configuration |
| `HUGGINGFACE_TOKEN` | Optional | Semantic search |
| `TAVILY_API_KEY`, `LANGFUSE_*` | Optional | Agent research and tracing |

The optional block is genuinely optional: the app boots on `DATABASE_URL`
alone, and an unset credential disables its feature rather than crashing or —
worse — opening it up. Verify any time with
`uv run python -m scripts.check_optional_credentials`.

**Credentials make a feature possible; they don't turn it on.** Once a key is
set, the switch at `/admin/settings/features` decides whether it actually runs,
without a redeploy. That is the intended workflow: put the keys on Render once,
then flip things on and off from the admin UI.

### The instance sleeps — and that breaks scheduled agent runs

A free Render service spins down after ~15 minutes without traffic. The agent
scheduler is APScheduler running **inside** that process, so while it is asleep
nothing schedules and nothing runs. No error, no log line, no draft.

The fix is to move the *timing* somewhere always awake and leave the *work*
where it is. `frontend/src/app/api/cron/agent/route.ts` does that: Vercel Cron
calls it, it mints the same admin JWT the browser session uses, and it POSTs the
existing `/admin/agent/trigger`. It contains no pipeline logic, adds no second
auth scheme, and stays governed by the agent feature switch — turn the agent off
in the admin UI and the cron gets the same 503 a human would.

Set up:

1. `CRON_SECRET` on Vercel (`openssl rand -base64 32`). Vercel sends it as
   `Authorization: Bearer …` on cron invocations. **Unset means the route
   refuses everyone**, including Vercel — it is a public URL, so it fails
   closed.
2. The schedule lives in `frontend/vercel.json` — `0 9 * * *`, daily at 09:00
   UTC.
3. On `/admin/settings/agent`, turn **Schedule active** off. On a sleeping host
   it was never firing anyway; if you later move to an always-on backend,
   leaving both on gets you two drafts a day.

Free-tier limits worth knowing (check current values — these move):

- Hobby allows **2 cron jobs, at most once per day**, and the firing time is
  best-effort rather than to the second. Daily drafts fit; hourly does not.
- Hobby functions cap at **60s**, which is why the route sets `maxDuration = 60`
  and aborts its own fetch at 55s. A deeply asleep Render instance can eat most
  of that waking up.
- **ponytail: one cron, no warm-up.** If runs start getting missed on the cold
  start, spend the second Hobby slot on a job a few minutes earlier that pings
  `/health` — traffic wakes Render and keeps it up ~15 minutes, so the real
  trigger then lands on a warm instance. Not built yet because one call
  usually makes it.

### Two more free-tier symptoms, same cause

- **A long pipeline run can be spun down mid-flight.** The trigger returns 202
  as soon as the run row is written and the work continues in a background
  task; if no request arrives during it, Render may stop the instance and the
  run stays `running` forever. Rare with a daily draft, unfixable without a
  paid instance.
- **The first visitor after a sleep can see a 502.** The proxy aborts at 20s
  (`src/app/api/proxy/[...path]/route.ts`, written when cold starts were ~7s on
  Railway) and a cold Render start can exceed that. A reload works. Raising
  that constant trades the error for a very long spinner — pick your poison, or
  pay for an always-on instance.

---

## 3. Vercel (frontend)

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Next.js (auto-detected) |
| Build / install | Defaults are correct |

### Environment: paste the file, don't type the vars

`frontend/.env.local` is gitignored on purpose — that is what keeps the fork's
branding out of every diff — which means **none of it reaches Vercel by
itself**. Every value has to be set there too.

Do not add them one at a time. Vercel's environment-variable UI accepts a
pasted `.env` file: open the whole of `.env.local`, paste, save. Use
`frontend/.env.example` as the checklist of what should be there — it lists
every variable the frontend reads, with upstream's default as the value.

Three that are easy to get wrong:

- `NEXTAUTH_URL` → the deployed URL, not localhost.
- `NEXT_PUBLIC_SITE_URL` → the real domain. `sitemap.xml`, `robots.txt` and
  every OpenGraph tag are built from it, so a stale value ships localhost URLs
  to search engines.
- `BACKEND_URL` → the Render URL, no trailing slash.

### Changing branding needs a redeploy

`NEXT_PUBLIC_*` is inlined into the bundle at build time, so a changed value
does nothing until the app is rebuilt.

Worth being precise about, because it is easy to blame the wrong thing: **on
Vercel this is not a `NEXT_PUBLIC_` limitation.** Deployments are immutable and
their environment is captured when they are built, so an env change requires a
redeploy whatever the prefix. Reading the same values server-side at runtime —
the usual "fix" — would buy nothing here. It would only help if you self-hosted
the frontend on a long-running Node server, where a restart would be enough.

So: change the value, hit **Redeploy**. If it did not change, you are looking at
the old deployment.

Verify what actually shipped rather than trusting the dashboard — the values are
in the bundle:

```bash
cd frontend && npm run build
grep -rho 'skin:"[a-z-]*",theme:"[a-z]*"' .next/static/chunks/ | sort -u
```

---

## 4. Push to deploy

Both hosts do this natively, so there is no CI file here and nothing to keep in
sync with them. A push to the deploy branch rebuilds both halves; the backend
brings the schema with it (above). What that costs is one setting on each side,
and they must name the **same branch** — otherwise a push deploys one half and
silently leaves the other on the previous commit, which looks exactly like a
caching problem and is not one.

| Host | Setting | Where |
|---|---|---|
| Render | Auto-Deploy on, deploy branch | Service → Settings → Build & Deploy |
| Vercel | Root Directory = `frontend` | Project → Settings → Build & Deployment |
| Vercel | Production Branch | Project → Settings → Git |

Three things that will bite:

- **`render.yaml` carries `autoDeploy: true`, but only if the service was
  created from the blueprint** (New → Blueprint). A service created by hand
  never read the file, so check the toggle rather than the repo.
- **The deploy branch is a dashboard setting, deliberately not in
  `render.yaml`.** A blueprint with no `branch:` key tracks the repository's
  *default* branch. Adding one would hardcode a branch name that only exists in
  one fork, into the file whose whole job is to be forkable — the same reason
  every secret in it is `sync: false`.
- **Vercel's Root Directory must be `frontend` before you connect the repo.**
  CLI deploys run from wherever you invoke them, so they work regardless;
  Git-triggered builds use this setting, and pointed at the repo root they fail
  in about two seconds with no obvious cause.

Connect Vercel to the repo with the Root Directory already set:

```bash
cd frontend && npx vercel git connect https://github.com/<you>/my-blog
```

### Previews get none of your environment

Vercel scopes environment variables per environment, and pasting `.env.local`
sets them for whichever ones were ticked at the time — usually Production
alone. Once the repo is connected, every push to a non-production branch builds
a preview that has *none* of them: upstream's branding, and a 502 from the
proxy because `BACKEND_URL` is unset and it falls back to localhost.

Paste the same file again with **Preview** ticked, with two changes:

- Add `BACKEND_URL` and `NEXT_PUBLIC_SITE_URL` — neither lives in `.env.local`.
- **Leave `NEXTAUTH_URL` out.** NextAuth reads it from the environment itself
  and falls back to Vercel's per-deployment `VERCEL_URL`; a fixed production URL
  would send every preview's sign-in callback to production. Unset is correct
  here, not an omission.

`CRON_SECRET` is not needed either — cron jobs only fire on production.

Previews share the production backend and the production database, so a
preview's admin UI writes to live data. Separating them means a second Render
service and a Neon branch, which is past what the free tiers cover.

## First deploy checklist

- [ ] `seed_owner` and `seed_data` against Neon (migrations run themselves)
- [ ] Content imported (`scripts/import_markdown`), or posts written in the admin
- [ ] `NEXTAUTH_SECRET` and `ADMIN_EMAIL` identical on Render and Vercel
- [ ] `https://<render>/health` returns `{"status":"ok"}`
- [ ] `BACKEND_URL` set on Vercel — without it the proxy falls back to
      `localhost:8000` and every API call is a 502, while the pages themselves
      render fine
- [ ] Render and Vercel deploy from the **same** branch
- [ ] Sign in at `/admin` — a 401 here is almost always mismatched secrets
- [ ] `/admin/settings/features` shows each feature as On or as *Unavailable*
      naming the variable it wants — that page is the fastest read of whether
      the backend env landed
- [ ] `/about` renders `content/about.md`, not the `SITE.intro` fallback
- [ ] `/sitemap.xml` shows the real domain
- [ ] Vercel → Settings → Cron Jobs lists `/api/cron/agent`; run it once by hand
      and read the response

## When free stops being enough

In the order it will actually bite: an always-on Render instance (kills the
sleep, the 502 and the mid-run shutdown in one move), then Neon storage at 0.5
GB, then Vercel's cron limits. The application code does not change for any of
them — this is all instance types and dashboards.
