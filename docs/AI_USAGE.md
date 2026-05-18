# AI Usage

This project was built with AI assistance. This document records, honestly,
which AI tools were used, what they produced, what was reviewed and corrected
by hand, and what was understood independently. It also covers the AI feature
that ships *inside* the product.

---

## 1. AI tools used to build MiniFlow

**Claude (Claude Code)** was the primary tool — used as a pair-programmer for
scaffolding, implementation, and tests across both the FastAPI backend and the
Next.js frontend.

### What AI helped produce

- **Boilerplate and scaffolding** — the FastAPI app structure, SQLAlchemy
  models, Pydantic schemas, Alembic migrations, and the Next.js component
  shells. This is repetitive, well-patterned code that AI generates quickly.
- **Test suites** — the `pytest` role × action matrices and the `vitest`
  component tests follow a consistent pattern, so AI was effective at
  expanding coverage once the first few tests established the style.
- **The design system** — the Tailwind component primitives (Button, Modal,
  Input, Badge, Toast) and the colour-token palette.
- **Repetitive feature wiring** — typed API client wrappers, the
  `useResource` data-fetching hook, and the CRUD routers, which all repeat a
  shape established once and then applied consistently.
- **Documentation drafts** — including the first pass of this file and
  `ARCHITECTURE.md`.

### What was reviewed, corrected, or decided by hand

AI output was not accepted blindly. Concretely:

- **The authorization model was a human decision.** The spec defines a `role`
  on both `users` and `project_members`. The choice to treat *per-project*
  roles as authoritative — and to keep `users.role` only as an account default
  — is a deliberate design call, documented in `ARCHITECTURE.md` and in the
  plan. AI implemented it; it did not decide it.
- **Auth security was verified manually** — that refresh tokens are stored
  hashed (not plaintext), that logout actually revokes, that refresh rotates,
  and that login errors don't leak whether an email exists. These were checked
  against the tests and by reading the code, not assumed.
- **AI-suggested error handling was tightened.** The first cut of the LLM
  integration caught failures loosely; it was reworked into explicit typed
  exceptions (`AINotConfigured`, `AIServiceError`, `AIInvalidResponse`) mapped
  to specific HTTP statuses (`503` / `502` / `422`).
- **Free-model selection was empirical.** AI initially defaulted to a model
  that turned out to be rate-limited upstream; candidate free models were
  tested directly against the OpenRouter API and `openai/gpt-oss-120b:free`
  was chosen because it returned clean JSON.
- **Test isolation bugs were caught and fixed.** Adding rate limiting would
  have broken the existing suite (many tests call `/login` and `/signup`);
  the fix — disabling the limiter in the test fixture and re-enabling it only
  in a dedicated test — was a deliberate correction.
- Every verification gate (`pytest`, `vitest`, `pnpm build`, `ruff`) was run
  and required to pass before work was considered complete.

### What was understood independently

The following are understood well enough to explain and modify without AI:

- **JWT auth flow** — why access tokens are short-lived, why refresh tokens
  are stored hashed, how rotation limits a stolen token, and how the frontend
  silently re-authenticates on a `401`.
- **The RBAC layering** — FastAPI dependencies (`get_current_user`,
  `get_project_membership`, `require_project_role`) for coarse checks, plus
  pure permission helpers for object-level rules, and why the frontend's
  permission checks are only cosmetic.
- **The data model and migrations** — the table relationships, the cascade
  rules, and why schema changes go through Alembic.
- **The AI features' failure modes** — what happens with no API key, an
  unreachable provider, or a malformed model reply, and the HTTP status each
  maps to.

---

## 2. The AI features inside the product

MiniFlow ships three AI features, all built on the same OpenRouter
integration and the same failure model:

- **Generate Subtasks** — on a task, "Generate with AI" asks an LLM for a
  short checklist of subtasks from the task's title and description.
- **Project progress summary** — "Summarize progress" on a project asks the
  LLM for a one-paragraph status report built from the project's tasks
  grouped by status. It is read-only, so any member — Viewers included — may
  run it.
- **Draft tasks from text** — "Draft with AI" on the task board turns a
  free-text note into a list of `{title, description, priority}` drafts the
  user reviews, edits, and bulk-creates as real tasks.

Common design across all three:

- **Provider:** OpenRouter (an OpenAI-compatible API). The default model is a
  free one, `openai/gpt-oss-120b:free`; provider, model, and key are all set
  via `LLM_*` environment variables, so it is easy to swap. A single shared
  `_chat()` helper issues the request for every feature.
- **Structured output:** features that need a list prompt the model for JSON
  only and parse it defensively — markdown fences and stray prose are
  tolerated, the first JSON array is extracted, malformed items are dropped,
  and the result is capped (10 subtasks, 15 task drafts).
- **Graceful failure:** a missing key, a network/provider error, or an
  unparseable reply each map — through one shared `ai_errors()` helper — to a
  clean HTTP status (`503` / `502` / `422`) and a friendly UI message. The app
  never crashes on a bad AI response.
- **Human in the loop:** no AI endpoint saves anything. Each returns a
  proposal — subtasks, a summary, or task drafts — and the person reviews,
  edits, and chooses what to keep. The AI proposes; the person decides.

---

## 3. Summary

AI accelerated the parts of this project that are pattern-heavy — scaffolding,
CRUD wiring, tests, and the design system — while the architecture decisions
(per-project RBAC, hashed rotating refresh tokens, the AI failure model) and
all verification were owned and understood by the developer. The goal was to
use AI as a force multiplier without outsourcing comprehension of the result.
