# Local development

Running the stack on your machine, and what is running in the background while
you do.

## TL;DR

```bash
# 1. Postgres (see the caveat below — it needs a live WSL session)
backend/scripts/dev_db.sh

# 2. Backend — http://localhost:8000
cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Frontend — http://localhost:3000
cd frontend && npm run dev
```

---

## There is a Postgres container running in the background

Local development uses a **Docker container**, not a hosted database:

| | |
|---|---|
| Container | `my-blog-pg` |
| Image | `pgvector/pgvector:pg16` — Postgres 16 with pgvector 0.8.6 preinstalled |
| Port | `5432` on localhost |
| User / password / db | `blog` / `blog` / `blog` |
| Connection string | `postgresql://blog:blog@localhost:5432/blog` (already in `backend/.env`) |
| Restart policy | `unless-stopped` |

Created with:

```bash
docker run -d --name my-blog-pg -p 5432:5432 \
  -e POSTGRES_USER=blog -e POSTGRES_PASSWORD=blog -e POSTGRES_DB=blog \
  pgvector/pgvector:pg16
```

`backend/scripts/dev_db.sh` does the above and the `docker start` for you:
running → say so, stopped → start it, absent → create it, then wait for
`pg_isready` so `alembic upgrade head` immediately after can't race it. Every
failure path prints the reason and the relevant `docker logs` tail.

It is **off unless `LOCAL_POSTGRES_DOCKER_FOR_DEV=true`** in `backend/.env` —
with `DATABASE_URL` pointing at Neon or Supabase, a script that starts
containers is a surprise, not a convenience. `DEV_DB_CONTAINER`, `DEV_DB_IMAGE`
and `DEV_DB_PORT` override the defaults above. `--dry-run` prints what it
resolved and touches nothing.

The image matters: the schema uses `Vector(384)` columns, so plain `postgres:16`
will fail on migration `b7e2f4a91c03`. That migration runs
`CREATE EXTENSION IF NOT EXISTS vector` itself — no manual extension setup, but
the extension has to be *available* in the image.

Useful commands:

```bash
docker ps -a --filter name=my-blog-pg     # is it up?
docker logs --tail 20 my-blog-pg          # why did it stop?
docker exec -it my-blog-pg psql -U blog -d blog   # a shell on the database
docker stop my-blog-pg                    # stop it
docker rm -f my-blog-pg                   # delete it, data included
```

### Caveat: the container dies when WSL has no live session

`dockerd` runs **inside the Ubuntu WSL distro** (native socket at
`/var/run/docker.sock`), not in Docker Desktop's own VM. WSL shuts a distro down
once its last session exits — which takes the daemon and every container with
it. The container stops cleanly (exit code 0, `received fast shutdown request`
in the logs), so it looks like a crash but isn't.

`--restart unless-stopped` does *not* help here: it restarts the container when
the daemon comes back, and the daemon isn't coming back until something opens a
WSL session again.

**In practice this is a non-issue**, because the backend server is itself a
long-lived WSL process — start it and the distro (and therefore the database)
stays up for as long as you're working. It only bites when you run a series of
one-shot `wsl -e ...` commands with nothing persistent in between, and see
"connection refused" on port 5432 between them.

If you want the database up without the backend running, hold a session open:

```bash
wsl -e bash -lc "docker start my-blog-pg && sleep infinity"
```

---

## First-time setup

```bash
cd backend
uv run alembic upgrade head        # 7 migrations, creates the vector extension
uv run python -m scripts.seed_owner # the admin Owner row
uv run python -m scripts.seed_data  # categories and tags
```

Note the `-m`. Several scripts under `scripts/` document themselves as
`python scripts/seed_owner.py`, which fails with `ModuleNotFoundError: No
module named 'app'` — running them as modules puts the backend root on
`sys.path`.

`seed_owner.py` creates the owner whose email is `ADMIN_EMAIL` in
`backend/.env`. This **must** match `ADMIN_EMAIL` in `frontend/.env.local`:
sign-in mints a JWT carrying that email, and the backend resolves it to an
`Owner` row. A mismatch is a 401 on every admin route with a valid-looking
token.

`seed_data.py` seeds categories and tags only — **no posts**. A fresh database
renders the site with empty states.

---

## Environment

Only `DATABASE_URL` is required. Everything else degrades:

| Unset | Effect |
|---|---|
| `NEXTAUTH_SECRET` | Admin API returns 401 for everyone (fails closed, never open) |
| `CLOUDINARY_*` | Image upload/delete return 503 |
| `HUGGINGFACE_TOKEN` | Search falls back to keyword-only (Postgres FTS) |
| `GROQ_API_KEY` / `AGENT_ENABLED=false` | Agent pipeline never runs |

Check it holds: `uv run python -m scripts.check_optional_credentials`

### Switching databases

`DATABASE_URL` accepts any provider's connection string **verbatim** —
`normalize_database_url()` in `app/config.py` rewrites the scheme to
`postgresql+asyncpg://` and translates libpq-only query params (`sslmode` →
`ssl`, dropping `channel_binding` and friends) that asyncpg rejects. Moving
between the local container, Neon, Supabase, Railway or Render is this one
value and nothing else.

Two provider notes:

- **Supabase**: use the direct connection (`db.<ref>.supabase.co:5432`), not
  the pooler on `:6543`. The pooler is pgbouncer in transaction mode, which
  breaks asyncpg's prepared statements; Alembic needs the direct one regardless.
- **Free tiers pause when idle** (Neon, Supabase). Expect a cold start, or use
  the local container and avoid the question entirely.

---

## Ports

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Postgres | localhost:5432 |

The frontend reaches the backend through `BACKEND_URL`, which defaults to
`http://localhost:8000` — so it needs setting only if the backend moves.

The backend binds `0.0.0.0` rather than `127.0.0.1` on purpose: when it runs
inside WSL and the browser is on Windows, a loopback-only bind isn't reachable
from the Windows side.
