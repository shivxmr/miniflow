# Comments on Tasks — Design

**Date:** 2026-05-18
**Status:** Approved, in implementation

## Goal

Let project members discuss a task via a comment thread. Comments appear in the
plan's mandatory RBAC matrix ("Member — comment on tasks") and in the bonus
list; the codebase already has an unused `can_comment()` stub. This feature
wires that up end to end.

## Scope

- A `comments` table; a comment belongs to one task and one author.
- Post a comment, list a task's comments, delete a comment.
- **No editing** — post/delete only. The plan only says "comment"; editing is
  YAGNI.

## Data model

New table `comments`:

| Column      | Type          | Notes                                  |
| ----------- | ------------- | -------------------------------------- |
| `id`        | UUID          | primary key                            |
| `task_id`   | UUID          | FK `tasks.id`, `ON DELETE CASCADE`, indexed |
| `user_id`   | UUID          | FK `users.id`, `ON DELETE CASCADE` (author) |
| `body`      | Text          | not null, 1–2000 chars                 |
| `created_at`| timestamptz   | server default `now()`                 |

Alembic migration `20260518_0004_add_comments` (deploy runs `alembic upgrade
head`; tests build the schema from metadata).

## API

Nested under tasks, mirroring subtasks. All routes resolve the task and the
caller's project membership via the existing `load_task_with_membership`
dependency (404 if task missing, 403 if caller is not a project member).

| Method + path                          | Who                          | Result |
| --------------------------------------- | ---------------------------- | ------ |
| `GET /tasks/{id}/comments`              | any project member (incl. Viewer) | `[CommentRead]`, oldest first |
| `POST /tasks/{id}/comments`             | Admin / Member (`can_comment`)    | `201 CommentRead` |
| `DELETE /tasks/{id}/comments/{cid}`     | comment author **or** project Admin | `204` |

`CommentRead` embeds the author as `{ id, name }` so the UI can show who wrote
each comment without a second request.

## Authorization

- `can_comment(role)` — already exists; Admin + Member, not Viewer.
- New `can_delete_comment(role, user_id, comment_user_id)` — Admin may delete
  any comment; everyone else only their own.
- Viewers may read comments but not post or delete.

## Frontend

- `Comment` / `CommentAuthor` types; `comments-api.ts` request wrappers.
- `canComment` and `canDeleteComment` helpers in `lib/permissions.ts`.
- A `CommentThread` component (mirrors `SubtaskList`): loading skeleton, empty
  state, comment list (author initial avatar, name, date, body, delete button
  when permitted), and a textarea + post button gated by `canComment`.
- Rendered inside the task edit modal below the subtask checklist. The modal
  receives `viewerRole` and `currentUserId` (passed down from `TaskBoard`).

## Testing

- Backend `tests/test_comments.py`: create / list / delete across every RBAC
  path (admin, member, viewer, non-member, author vs non-author), blank-body
  422, wrong-task 404, missing-comment 404, task-delete cascade.
- Frontend `comment-thread.test.tsx`: renders comments, posts a comment,
  deletes own comment, hides the composer for viewers, surfaces errors.
- Full backend `pytest`, frontend `pnpm build` + `pnpm test`.
- Live smoke test against the running API before pushing.

## Out of scope

Comment editing, threaded replies, mentions, reactions, edit history.
