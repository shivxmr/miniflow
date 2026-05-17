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
- **The AI feature's failure modes** — what happens with no API key, an
  unreachable provider, or a malformed model reply, and the HTTP status each
  maps to.

---

## 2. The AI feature inside the product

MiniFlow ships one AI feature: **Generate Subtasks**.

- **What it does:** on a task, "Generate with AI" sends the task's title and
  description to an LLM and asks for a short checklist of subtasks.
- **Provider:** OpenRouter (an OpenAI-compatible API). The default model is a
  free one, `openai/gpt-oss-120b:free`; provider, model, and key are all set
  via `LLM_*` environment variables, so it is easy to swap.
- **Structured output:** the model is prompted to return only a JSON array of
  title strings. Parsing is defensive — markdown fences and stray prose are
  tolerated, the first JSON array is extracted, blank/non-string items are
  dropped, and the list is capped at 10.
- **Graceful failure:** a missing key, a network/provider error, or an
  unparseable reply each produce a clean HTTP status and a friendly UI
  message — the app never crashes on a bad AI response.
- **Human in the loop:** generation does **not** save anything. It returns
  suggestions; the user reviews, edits, deselects, and chooses what to save as
  real subtasks. The AI proposes; the person decides.

---

## 3. Summary

AI accelerated the parts of this project that are pattern-heavy — scaffolding,
CRUD wiring, tests, and the design system — while the architecture decisions
(per-project RBAC, hashed rotating refresh tokens, the AI failure model) and
all verification were owned and understood by the developer. The goal was to
use AI as a force multiplier without outsourcing comprehension of the result.
