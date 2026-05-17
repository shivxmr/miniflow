/**
 * Typed wrappers for the MiniFlow comment endpoints (nested under a task).
 *
 * Every function takes an {@link AuthedRequest} so calls automatically carry
 * the access token and silently recover from an expired one.
 */

import type { AuthedRequest } from "./api";
import type { Comment } from "./types";

/** Fetches a task's comment thread, oldest first. */
export function listComments(
  request: AuthedRequest,
  taskId: string,
): Promise<Comment[]> {
  return request<Comment[]>(`/tasks/${taskId}/comments`);
}

/** Posts a new comment on a task. */
export function createComment(
  request: AuthedRequest,
  taskId: string,
  body: string,
): Promise<Comment> {
  return request<Comment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: { body },
  });
}

/** Permanently deletes a comment. */
export function deleteComment(
  request: AuthedRequest,
  taskId: string,
  commentId: string,
): Promise<void> {
  return request<void>(`/tasks/${taskId}/comments/${commentId}`, {
    method: "DELETE",
  });
}
