# MiniFlow

A lightweight project-management platform — projects, a Kanban task board,
team roles, and AI-assisted task breakdowns. Inspired by Asana and Trello.

> **Live demo:** **https://miniflow-asana.vercel.app**
> &nbsp;&nbsp;Web on Vercel · API ([miniflow-api.onrender.com](https://miniflow-api.onrender.com)) on Render · Database on Neon
> &nbsp;&nbsp;_Render's free tier sleeps when idle — the first request may take ~30s to wake._

---

## Features

- **Auth** — signup / login / logout with hand-built JWT (bcrypt hashing,
  short-lived access tokens, rotating refresh tokens, silent re-auth on 401).
- **Projects** — create, edit, delete; invite members by email.
- **Role-based access control** — per-project Admin / Member / Viewer roles,
  enforced server-side on every action.
- **Task board** — Kanban board (To Do / In Progress / Done) and a list view;
  tasks have a description, priority, due date, and assignee.
- **AI subtask generation** — break a task into a checklist with one click;
  suggestions are reviewed and edited before saving.
- **Drag-and-drop** — move task cards between columns to change status.
- **Dark mode** — persisted, with no flash on load.
- Loading / empty / error states throughout; responsive from mobile up.

## Tech stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4    |
| Backend  | FastAPI (Python 3.12), SQLAlchemy 2.0, Alembic          |
| Database | PostgreSQL 16                                           |
| AI       | OpenRouter (OpenAI-compatible API)                      |
| Tooling  | `uv`, `pnpm`, `ruff`, `pytest`, `vitest`                |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the auth design, RBAC
model, database schema (ERD), and tradeoffs, and
[`docs/AI_USAGE.md`](docs/AI_USAGE.md) for how AI tooling was used to build it.

## Repository layout

```
asana_clone/
├─ api/                FastAPI backend  (app/, alembic/, tests/)
├─ web/                Next.js frontend (src/app, components, lib, hooks)
├─ docs/               ARCHITECTURE.md, AI_USAGE.md, plan.md
└─ docker-compose.yml  local PostgreSQL
```

---

## Local setup

### Prerequisites

- [Docker](https://www.docker.com/) (for PostgreSQL)
- [uv](https://docs.astral.sh/uv/) — Python package manager
- [pnpm](https://pnpm.io/) and Node.js 20+
- An [OpenRouter API key](https://openrouter.ai/keys) (free tier) for the AI
  feature — the rest of the app runs without it.

### 1. Clone & configure environment

```bash
git clone <repo-url> asana_clone
cd asana_clone
cp api/.env.example api/.env
cp web/.env.example web/.env.local
```

Then open `api/.env` and set `LLM_API_KEY` to your OpenRouter key.

### 2. Start PostgreSQL

```bash
docker compose up -d        # Postgres 16 on localhost:5432
```

### 3. Run the API

```bash
cd api
uv sync                     # install dependencies
uv run alembic upgrade head # apply migrations
uv run python seed.py       # optional: load sample data
uv run uvicorn app.main:app --reload
```

The API serves at `http://localhost:8000` (`/health`, interactive docs at
`/docs`).

### 4. Run the web app

```bash
cd web
pnpm install
pnpm dev                    # http://localhost:3000
```

Open `http://localhost:3000`, sign up, and start creating projects.

---

## Environment variables

### `api/.env`

| Variable                     | Default                          | Purpose                                        |
| ---------------------------- | -------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`               | local Postgres                   | SQLAlchemy connection string                   |
| `SECRET_KEY`                 | dev placeholder                  | JWT signing key — **set a strong value in prod** |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| `15`                             | Access-token lifetime                          |
| `REFRESH_TOKEN_EXPIRE_DAYS`  | `7`                              | Refresh-token lifetime                         |
| `BACKEND_CORS_ORIGINS`       | `http://localhost:3000`          | Comma-separated allowed web origins            |
| `AUTH_RATE_LIMIT`            | `10/minute`                      | Rate limit for `/login` and `/signup`          |
| `LLM_PROVIDER`               | `openrouter`                     | LLM provider label                             |
| `LLM_API_KEY`                | _(empty)_                        | OpenRouter API key — required for AI subtasks  |
| `LLM_MODEL`                  | `openai/gpt-oss-120b:free`       | Model used for subtask generation              |
| `LLM_BASE_URL`               | `https://openrouter.ai/api/v1`   | OpenAI-compatible base URL                     |

### `web/.env.local`

| Variable              | Default                  | Purpose                  |
| --------------------- | ------------------------ | ------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`  | Base URL of the API      |

`.env` files are git-ignored; never commit real secrets. `*.env.example`
files document the expected keys.

---

## Running tests

```bash
# Backend — needs Docker Postgres running (it uses a miniflow_test database)
cd api && uv run pytest -q

# Backend lint
cd api && uv run ruff check .

# Frontend
cd web && pnpm test

# Frontend production build (type-checks everything)
cd web && pnpm build
```

---

## Deployment

MiniFlow deploys as three pieces:

| Piece    | Host                      | Notes                                          |
| -------- | ------------------------- | ---------------------------------------------- |
| Database | [Neon](https://neon.tech) | Managed Postgres; copy the connection string   |
| API      | [Render](https://render.com) | Web Service; runs migrations on deploy      |
| Web      | [Vercel](https://vercel.com) | Import the `web/` directory                  |

**API (Render)** — start command:

```bash
uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set `DATABASE_URL`, `SECRET_KEY`, `LLM_API_KEY`, and
`BACKEND_CORS_ORIGINS` (to the Vercel URL) as environment variables.

**Web (Vercel)** — set `NEXT_PUBLIC_API_URL` to the Render API URL.

Full click-by-click instructions are in [`docs/DEPLOY.md`](docs/DEPLOY.md).
A Render blueprint ([`render.yaml`](render.yaml)) provisions the API service.

---

## License

Built as a portfolio project. Not licensed for production use as-is.
