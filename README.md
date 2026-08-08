# d3jusdevspace

My personal AI-powered blog and knowledge hub. A full-stack application featuring a Next.js frontend and a FastAPI backend.

## Project Structure

This repository is organized as a monorepo containing two main parts:

- **[`/frontend`](./frontend/)**: Next.js 17 application with Tailwind CSS v4, React Query, and BlockNote. It serves both the public-facing blog and the admin CMS dashboard, including agent settings, run log, and draft review pages.
- **[`/backend`](./backend/)**: FastAPI application with SQLAlchemy 2.0 and PostgreSQL (Neon), providing REST APIs for content management, taxonomy, search, an autonomous AI agent pipeline (LangGraph), and Cloudinary image uploads.

## Key Features

- **Hybrid Search** — Semantic (pgvector cosine similarity) combined with PostgreSQL full-text search, ranked and merged with aggregated scoring. Highlighted snippets with `<mark>` tags.
- **Rich Markdown Editing** — Block-based editor (BlockNote) with seamless Cloudinary image uploads and code block support.
- **Taxonomy & Series Management** — Group posts by categories, tags, and series with full CRUD.
- **Admin Authentication** — JWT-based authentication via NextAuth.js.
- **AI Agent Pipeline** — 5-node LangGraph pipeline that autonomously generates blog post drafts: topic selection via Groq LLM, web research (Tavily), semantic context retrieval (pgvector), writing tone analysis from published corpus, and markdown draft generation — all instrumented end-to-end with LangFuse observability.
- **APScheduler Cron Scheduling** — Schedule automatic agent runs with configurable cron expressions (daily, weekly, bi-weekly, or custom).
- **Agent Settings & Run Log** — Admin UI for schedule management, manual pipeline triggers, and full run history with status, duration, and LangFuse trace links.
- **Agent Draft Review** — Review, edit, publish, or delete agent-generated drafts from a dedicated admin page.
- **Context Embeddings** — User context (bio, interests, learning focus) is automatically embedded and stored in pgvector for semantically relevant topic selection.
- **Cyber-Luxury Aesthetic** — Custom design tokens, dark mode default, and smooth transitions.

## Getting Started

To run the project locally, you will need to set up both the backend and frontend.

### 1. Backend Setup

See the [Backend README](./backend/README.md) for detailed instructions.

```bash
cd backend
uv sync
cp .env.example .env
# Configure your .env variables (Database, NextAuth, Cloudinary, Groq, Tavily, LangFuse)
uv run alembic upgrade head
uv run python scripts/seed_owner.py
uv run uvicorn main:app --reload
```

### 2. Frontend Setup

See the [Frontend README](./frontend/README.md) for detailed instructions.

```bash
cd frontend
npm install
cp .env.example .env.local
# Configure your .env.local variables
npm run dev
```

Both servers must be running for the application to function correctly, as the frontend proxies API requests to the backend.

## Agent Pipeline Environment Variables

The agent pipeline requires the following additional environment variables in `backend/.env`:

| Variable              | Required | Default                      | Description                                            |
| --------------------- | -------- | ---------------------------- | ------------------------------------------------------ |
| `GROQ_API_KEY`        | Yes      | —                            | API key for Groq LLM (llama-3.3-70b-versatile)         |
| `TAVILY_API_KEY`      | No       | —                            | API key for Tavily web search (skipped if empty)       |
| `LANGFUSE_PUBLIC_KEY` | No       | —                            | LangFuse public key for observability (no-op if empty) |
| `LANGFUSE_SECRET_KEY` | No       | —                            | LangFuse secret key                                    |
| `LANGFUSE_HOST`       | No       | `https://cloud.langfuse.com` | LangFuse host URL                                      |

The pipeline runs without Tavily or LangFuse keys — research is skipped and tracing is a no-op. Only `GROQ_API_KEY` is required.

---

## Note for this fork (`t569/my-blog`)

This is a fork of [DejusDevspace/my-blog](https://github.com/DejusDevspace/my-blog),
which is the original work of **DejusDevspace** — the architecture, the agent
pipeline, and the design system are all his.

That creates a small dilemma. This fork needs to be *my* blog (my name, my
links, my favicon, my palette), but I also want upstream merges to stay
possible in both directions — and a fork that rewrites every string is a fork
that conflicts on every sync, and quietly takes credit for someone else's work.

The compromise:

- **Branding is env-driven, never hardcoded.** Every brand value in
  `frontend/src/lib/constants.ts` reads
  `process.env.NEXT_PUBLIC_SITE_* ?? "<upstream default>"`. My values live in
  `frontend/.env.local`, which is gitignored — so none of my branding appears
  in the diff, and merging this fork upstream leaves that site unchanged.
- **Attribution stays put.** Comment headers, `docs/`, and the
  `app/devspace_agents/` package keep their original names. Renaming them would
  be pure merge-conflict fodder for zero user-visible benefit.
- **Themes are files, not edits.** Palettes live in
  `frontend/src/styles/themes/*.css`, one file per theme, registered in
  `providers.tsx`. A new look is a new file, not a rewrite of `globals.css`.

Overriding the brand for your own fork:

| Variable | Default |
| --- | --- |
| `NEXT_PUBLIC_SITE_NAME` | `d3jusdevspace` |
| `NEXT_PUBLIC_SITE_TAGLINE` | `AI engineer, builder, thinker` |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | upstream description |
| `NEXT_PUBLIC_SITE_MOTTO` | `BUILT FOR THE AGENTIC AGE` |
| `NEXT_PUBLIC_SITE_ICON` | `/favicon.ico` |
| `NEXT_PUBLIC_SITE_REPO` / `_GITHUB` / `_TWITTER` / `_LINKEDIN` | upstream links |

Deploying it: [docs/deployment.md](./docs/deployment.md) — Vercel, Render and
Neon, all on free tiers, including the two things that only break once hosted.

Progress and remaining work: [TODO.md](./TODO.md).
