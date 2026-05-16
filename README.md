# MiniFlow

MiniFlow is a lightweight project management platform inspired by Asana and Trello.

## Stack

- Web: Next.js App Router, TypeScript, Tailwind CSS
- API: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL 16 via Docker Compose

## Local Setup

1. Copy env files as needed:

```bash
cp .env.example .env
cp api/.env.example api/.env
cp web/.env.example web/.env.local
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Run the API:

```bash
cd api
uv sync
uv run alembic upgrade head
uv run python seed.py
uv run uvicorn app.main:app --reload
```

4. Run the web app:

```bash
cd web
npm install
npm run dev
```

## Current Status

- Step 1: Project scaffolding, repo, tooling, Docker Compose, API health route, web skeleton.
- Step 2: Mandatory database model, Alembic migration, and seed script.
- Auth API: signup, login, current user, refresh rotation, logout revocation, bcrypt password hashing, JWT access tokens.
