# MiniFlow — Implementation Plan

A 10-step build plan for the lightweight project management platform described in
[`AI Coding Project Plan (Asana Clone).md`](./AI%20Coding%20Project%20Plan%20%28Asana%20Clone%29.md).

**Rule of execution:** Each step has a defined *Result* and a *Verification Gate*. Do **not**
start the next step until the current step's gate passes with evidence (command output, a
working screen, green tests). Steps 1–8 deliver every **mandatory** requirement. Step 9 adds
the AI feature and selected easy bonuses. Step 10 hardens, deploys, and produces deliverables.

---

## Locked Decisions & Tradeoffs

| Area             | Decision                                                                                                                                                                                                                                                                                                                            | Why / Tradeoff                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack            | Next.js 15 App Router (TS, Tailwind) + FastAPI (Python) + PostgreSQL                                                                                                                                                                                                                                                                | Matches the spec's recommended stack; a separate backend best demonstrates "Backend Architecture" and "Separation of concerns" in the rubric. Tradeoff: two deploy targets instead of one.                                                                 |
| ORM / migrations | SQLAlchemy 2.0 (typed) + Alembic                                                                                                                                                                                                                                                                                                    | Industry-standard, gives real migration history (rubric: "Database modeling").                                                                                                                                                                             |
| Auth             | Hand-built JWT: bcrypt hashing, short-lived access token + long-lived refresh token, custom FastAPI dependencies for auth + RBAC                                                                                                                                                                                                    | Auth & Security is 25% of the rubric; hand-built code is what gets evaluated. Refresh tokens are stored hashed so logout = revocation.                                                                                                                     |
| RBAC model       | **Per-project roles are authoritative.** `project_members.role` (Admin/Member/Viewer) decides every project-scoped permission. `users.role` is kept per the schema spec as the account's *default* role and is never used for project authorization. Any authenticated user may create a project and becomes its Admin. | The schema gives roles in*both* tables; the permission table mixes global ("Create projects") and project-scoped ("Change roles") actions. Per-project roles is the only model that is internally consistent. Documented openly as engineering judgment. |
| AI feature       | "Generate subtasks" — Claude API (Haiku 4.5) turns a task into a checklist of subtasks; user reviews before saving.                                                                                                                                                                                                                | Bounded scope, structured output, graceful-failure path.                                                                                                                                                                                                   |
| Subtasks model   | Dedicated `subtasks` table (lightweight checklist), introduced in Step 9                                                                                                                                                                                                                                                          | Simpler than self-referential tasks; matches "AI-generated task breakdowns."                                                                                                                                                                               |
| Deployment       | Local-first via Docker Compose (Postgres); Step 10 deploys web → Vercel, API → Render/Railway, DB → Neon                                                                                                                                                                                                                         | Satisfies the "Deploy online" deliverable without slowing core development.                                                                                                                                                                                |
| Repo             | Single git repo, monorepo layout (`/api`, `/web`)                                                                                                                                                                                                                                                                               | One GitHub repo deliverable; clear front/back separation.                                                                                                                                                                                                  |

**Use "uv" and not "pip" for all Python commands as its fast**

**Target repo layout**

```
asana_clone/
├─ api/                  # FastAPI backend
│  ├─ app/
│  │  ├─ core/           # config, security, db session
│  │  ├─ models/         # SQLAlchemy models
│  │  ├─ schemas/        # Pydantic request/response models
│  │  ├─ api/            # routers (auth, projects, tasks, ...)
│  │  ├─ services/       # business logic
│  │  └─ deps/           # auth + RBAC dependencies
│  ├─ alembic/           # migrations
│  └─ tests/             # pytest
├─ web/                  # Next.js frontend
│  └─ src/{app,components,lib,hooks}/
├─ docker-compose.yml
├─ docs/
└─ README.md
```

---

## Step 1 — Project Scaffolding, Repo & Tooling

**Goal:** A running skeleton for both apps under one git repo.

**Tasks**

- `git init`; add `.gitignore` (Python, Node, env files, `.DS_Store`).
- Create monorepo layout above.
- `api/`: FastAPI app with a `GET /health` route, `requirements.txt`/`pyproject`, virtualenv, `ruff` + `pytest` configured.
- `web/`: Next.js 15 (App Router, TypeScript, Tailwind) via `create-next-app`.
- `docker-compose.yml` with a PostgreSQL 16 service + named volume.
- `.env.example` for both apps; real `.env` files git-ignored.
- README skeleton (setup steps placeholder).
- Initial commit.

**Result:** Both apps boot locally; Postgres runs in Docker; repo has a clean first commit.

**Verification Gate**

- `docker compose up -d` → `docker compose ps` shows Postgres healthy.
- `uvicorn app.main:app` → `curl localhost:8000/health` returns `{"status":"ok"}`.
- `npm run dev` in `web/` → default page renders at `localhost:3000`.
- `git log` shows the initial commit; `git status` is clean.

---

## Step 2 — Database Schema & Migrations

**Goal:** The full mandatory data model, versioned with Alembic.

**Tasks**

- SQLAlchemy 2.0 typed models + Postgres enums:
  - `users` — id (UUID PK), name, email (unique, indexed), password_hash, role (`admin|member|viewer`, default `member`), created_at.
  - `projects` — id, name, description, created_by → users, created_at.
  - `project_members` — id, project_id → projects, user_id → users, role (`admin|member|viewer`), `UNIQUE(project_id,user_id)`.
  - `tasks` — id, project_id → projects, title, description, assigned_to → users (nullable), status (`todo|in_progress|done`, default `todo`), priority (`low|medium|high`, default `medium`), due_date (nullable), created_by → users, created_at, updated_at.
- Cascade rules (deleting a project removes its members & tasks).
- Alembic initialized; first migration generated.
- `seed.py`: creates 3 users (one per role), 1 project with members, a few tasks.

**Result:** All four mandatory tables exist with correct constraints; seed data loads.

**Verification Gate**

- `alembic upgrade head` succeeds from an empty database.
- `\dt` in psql lists `users, projects, project_members, tasks`; `\d tasks` shows enums, FKs, defaults.
- `alembic downgrade base` then `upgrade head` round-trips cleanly.
- `python seed.py` populates rows; verified via a `SELECT`.

---

## Step 3 — Authentication Backend (Custom JWT)

**Goal:** Secure signup/login/logout with hand-built JWT, written test-first.

**Tasks**

- Password hashing with bcrypt (via `passlib`).
- JWT access token (~15 min) + refresh token (~7 days). Refresh tokens stored **hashed** in a `refresh_tokens` table (Alembic migration) → enables true logout/revocation and rotation.
- Endpoints: `POST /signup`, `POST /login`, `POST /logout`, `POST /refresh`, `GET /me`.
- `get_current_user` FastAPI dependency: parses Bearer token, validates signature/expiry, loads user.
- Pydantic validation: email format, password min length, etc.
- Consistent JSON error shape; no leaking which field was wrong on login.
- pytest coverage for every path (TDD: tests before implementation).

**Result:** A user can sign up, log in, fetch `/me`, refresh, and log out; tokens are verified server-side.

**Verification Gate**

- `pytest tests/test_auth.py` is green and covers: signup, duplicate email rejected, login success, wrong password rejected, `/me` with valid token, `/me` with missing/expired/tampered token rejected (401), refresh rotates, logout revokes refresh token.
- Manual curl flow: signup → login → `/me` → refresh → logout → refreshing the revoked token fails.
- DB check: `password_hash` is a bcrypt hash, never plaintext.

---

## Step 4 — Authorization / RBAC Middleware

**Goal:** Backend-enforced role-based access control (not frontend hiding).

**Tasks**

- `require_project_role(...)` dependency: resolves the caller's `project_members.role` for a given project; 403 if not a member.
- Permission helpers encoding the spec matrix:
  - **Admin** — manage members, change roles, edit/delete any task, edit/delete project.
  - **Member** — create tasks, update/delete *own* tasks, comment, view.
  - **Viewer** — read-only.
- Reusable dependencies so routers stay declarative.
- Object-level checks (e.g. Member editing only tasks they created/are assigned).

**Result:** Every project-scoped action is gated server-side by the caller's project role.

**Verification Gate**

- `pytest tests/test_rbac.py` green — a role × action matrix: viewer blocked from all writes (403), member blocked from deleting others' tasks and from member management, admin allowed everything, non-member blocked entirely (403).
- Manual curl: a viewer token gets 403 on `POST /tasks`.

---

## Step 5 — Projects & Tasks API

**Goal:** All mandatory CRUD endpoints, wired with auth + RBAC.

**Tasks**

- Projects: `GET /projects` (only the caller's projects), `POST /projects` (creator → Admin member), `GET /projects/:id`, `PUT /projects/:id`, `DELETE /projects/:id`.
- Members: `GET/POST/PUT/DELETE /projects/:id/members[/:userId]` (Admin-only writes).
- Tasks: `GET /projects/:id/tasks` (filter by status/priority/assignee, paginated), `POST /tasks`, `GET /tasks/:id`, `PUT /tasks/:id`, `DELETE /tasks/:id`.
- Pydantic request/response schemas; service layer holds business logic, routers stay thin.
- Uniform error responses; correct status codes (400/401/403/404/409).

**Result:** The full mandatory API contract works end-to-end with authorization applied.

**Verification Gate**

- `pytest` full suite green (auth + rbac + projects + tasks), meaningful coverage on services.
- `/docs` (OpenAPI) lists every endpoint with correct schemas.
- Manual curl: create project → add member → create task → assign → update status → delete, each respecting roles.

---

## Step 6 — Frontend Foundation & Auth UI

**Goal:** Next.js app shell, design system, and working auth screens.

**Tasks**

- Tailwind theme + reusable primitives (Button, Input, Card, Modal, Badge, Spinner, Toast).
- Typed API client (`fetch` wrapper) with base URL from env, JSON handling, error normalization.
- Auth context/provider: stores tokens, exposes `user`, `login`, `logout`, auto-refresh on 401.
- Pages: `/login`, `/signup` with client + server validation feedback.
- Route protection: unauthenticated users redirected from app routes to `/login`.
- Loading and error states on auth forms.

**Result:** A user can sign up and log in through the UI against the real API; protected routes redirect when logged out.

**Verification Gate**

- Sign up a new user via UI → lands authenticated.
- Log out → app routes redirect to `/login`.
- Log in again → session restored; expired access token auto-refreshes silently.
- Invalid credentials show a clear inline error.

---

## Step 7 — Dashboard & Projects UI

**Goal:** Project management screens with full state handling.

**Tasks**

- Dashboard: lists the user's projects with empty state ("No projects yet") and loading skeletons.
- Project create/edit/delete (modal/form), with confirm on delete.
- Project detail header; member management panel — invite by email, change role, remove — **visible/enabled per the caller's project role**.
- Error states (failed fetch → retry), responsive layout (mobile → desktop).

**Result:** Full project + membership lifecycle works through the UI, RBAC-aware.

**Verification Gate**

- Create → edit → delete a project via UI; list updates.
- As Admin: add a member, change their role, remove them.
- As Viewer: write controls are hidden/disabled; API still rejects if forced.
- Resize to mobile width — layout holds; loading/empty/error states all visibly render.

---

## Step 8 — Task Board UI

**Goal:** The core task workflow — board + list views.

**Tasks**

- Project page with a Kanban board: **Todo / In Progress / Done** columns, plus a list view toggle.
- Task creation modal/form: title, description, priority, status, due date, assignee (project members).
- Task detail/edit modal; delete with confirm.
- Status change updates the board; controls gated by project role.
- Loading skeletons, empty column states, error handling, responsive board.

**Result:** Full task lifecycle works through the UI; changes persist to the API.

**Verification Gate**

- Create a task → appears in the right column.
- Edit fields, change status → board reflects it; reload confirms persistence.
- As Member: can edit own tasks, blocked from others'. As Viewer: read-only.
- Empty/loading/error states render; board is responsive.

> **End of Step 8 = every mandatory requirement is complete and verified.**

---

## Step 9 — AI Feature (Generate Subtasks) + Easy Bonuses

**Goal:** The optional AI twist plus high-value, low-risk bonus features.

**Tasks**

- **AI — Generate Subtasks (primary):**
  - `subtasks` table + Alembic migration (id, task_id, title, is_done, created_at).
  - `POST /tasks/:id/subtasks/generate` → calls Claude API (Haiku 4.5) with the task title/description, requests a structured JSON list of subtasks, validates the response.
  - Graceful failure: timeouts/invalid output return a clean error, never a crash; API key from env.
  - UI: "Generate subtasks with AI" button → loading state → review list → user accepts/edits before saving; subtasks render as a checklist on the task.
- **Easy bonuses (in priority order; do as many as time allows):**
  1. Drag-and-drop on the Kanban board (drag a task between columns → status update).
  2. Dark mode (theme toggle, persisted).
  3. Search & filter on the task board (by title, status, priority, assignee).
  4. Comments on tasks (`comments` table; Member+ can comment).
  5. Activity log (`activity_logs` table; record create/update/delete events per project).

**Result:** AI subtask generation works reliably with graceful failure; bonuses function without regressing mandatory features.

**Verification Gate**

- Trigger AI generation on a real task → subtasks returned, reviewed, saved; checklist toggles persist.
- Force a failure (bad/empty API key) → UI shows a friendly error, app stays usable.
- Each completed bonus demonstrably works; `pytest` and a manual smoke test of Steps 1–8 still pass.

---

## Step 10 — Hardening, Deployment & Deliverables

**Goal:** Ship a secure, deployed product with complete documentation.

**Tasks**

- **Security pass:** CORS locked to the web origin, basic rate limiting on auth routes, input validation review, no secrets in the repo, security headers, dependency audit.
- **Quality pass:** full `pytest` green, `ruff` clean, frontend build with no type errors, dead code removed.
- **Deploy:** DB → Neon; API → Render/Railway (run migrations on deploy); web → Vercel; wire production env vars; verify the live URL end-to-end.
- **Deliverables:**
  - `README.md` — overview, architecture, full local setup, env vars, deploy notes, live URL.
  - `docs/ARCHITECTURE.md` — stack choices, auth approach, authorization design, DB schema (with diagram), tradeoffs.
  - `docs/AI_USAGE.md` — AI tools used, what AI helped with, what was manually fixed/understood (required deliverable).
  - Loom walkthrough script/checklist (product demo, architecture, AI usage, challenges).
- Final commit; clean git history with meaningful messages throughout.

**Result:** A live, secure, documented MiniFlow with all deliverables present.

**Verification Gate**

- Live URL: sign up → create project → add member → create/move tasks → generate AI subtasks, all working in production.
- Fresh `git clone` + README steps brings the app up locally with no missing instructions.
- All three docs exist and are complete; `pytest` green; production build succeeds.
- `git log` shows a coherent, well-described commit history.

---

## Coverage Check — Mandatory Requirements → Steps

| Requirement                                                        | Step(s) |
| ------------------------------------------------------------------ | ------- |
| Auth: signup/login/logout, hashing, JWT, protected routes          | 3, 6    |
| Authorization / RBAC in backend middleware                         | 4, 5    |
| Projects CRUD                                                      | 5, 7    |
| Tasks (title, desc, priority, status, due date, assignee, creator) | 2, 5, 8 |
| Task statuses Todo/In Progress/Done                                | 2, 8    |
| Dashboard UI, auth pages, task board, task modal                   | 6, 7, 8 |
| Responsive, loading/empty/error states                             | 6, 7, 8 |
| API design (spec endpoints)                                        | 5       |
| Database design (spec schema)                                      | 2       |
| AI feature (optional twist)                                        | 9       |
| Deployment + README + Architecture/AI docs                         | 10      |

**Working method throughout:** test-driven on the backend (tests before implementation),
small meaningful commits, and the verification gate must pass before advancing.
