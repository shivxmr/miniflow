"use client";

import { type FormEvent, useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks/use-resource";
import { type AuthedRequest, errorMessage } from "@/lib/api";
import { createComment, deleteComment, listComments } from "@/lib/comments-api";
import { formatDate, initial } from "@/lib/format";
import { canComment, canDeleteComment } from "@/lib/permissions";
import type { Comment, UserRole } from "@/lib/types";

interface CommentThreadProps {
  request: AuthedRequest;
  taskId: string;
  /** The viewer's project role — gates posting and deleting. */
  viewerRole: UserRole;
  /** The viewer's user id — used to tell which comments they may delete. */
  currentUserId: string;
}

const COMPOSER_CLASS =
  "w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 " +
  "text-sm text-ink placeholder:text-faint transition-colors focus:border-accent " +
  "focus:outline-none focus:ring-2 focus:ring-accent/35 focus:ring-offset-1 " +
  "focus:ring-offset-paper";

/**
 * The comment thread shown inside the task edit modal. Any project member may
 * read it; Admins and Members may post, and may delete their own comments
 * (Admins may delete anyone's).
 */
export function CommentThread({
  request,
  taskId,
  viewerRole,
  currentUserId,
}: CommentThreadProps) {
  const comments = useResource(() => listComments(request, taskId), [taskId]);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items: Comment[] = comments.data ?? [];

  async function handlePost(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await createComment(request, taskId, body);
      setDraft("");
      comments.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(commentId: string) {
    setBusy(true);
    setError("");
    try {
      await deleteComment(request, taskId, commentId);
      comments.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Comments</h3>
        {items.length > 0 && (
          <span className="text-xs font-medium text-muted">{items.length}</span>
        )}
      </div>

      {comments.loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-3/4 rounded-lg" />
        </div>
      )}

      {!comments.loading && items.length === 0 && (
        <p className="text-xs text-muted">No comments yet.</p>
      )}

      {!comments.loading && items.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {items.map((comment) => (
            <li
              key={comment.id}
              data-testid="comment-item"
              className="flex gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5"
            >
              <div
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
              >
                {initial(comment.author.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-ink">
                    {comment.author.name}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">
                  {comment.body}
                </p>
              </div>
              {canDeleteComment(viewerRole, currentUserId, comment.author.id) && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Delete comment from ${comment.author.name}`}
                  onClick={() => handleDelete(comment.id)}
                  className="h-fit shrink-0 rounded p-1 text-muted transition-colors hover:text-danger disabled:opacity-50"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <FormAlert message={error} />}

      {canComment(viewerRole) && (
        <form onSubmit={handlePost} className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            aria-label="Write a comment"
            maxLength={2000}
            rows={2}
            className={COMPOSER_CLASS}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={busy || draft.trim().length === 0}
            className="self-end"
          >
            Comment
          </Button>
        </form>
      )}
    </section>
  );
}
