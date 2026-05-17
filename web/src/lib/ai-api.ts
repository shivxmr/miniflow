/**
 * Typed wrappers for the MiniFlow AI endpoints.
 *
 * Every function takes an {@link AuthedRequest} so calls automatically carry
 * the access token and silently recover from an expired one.
 */

import type { AuthedRequest } from "./api";
import type { TaskDraft } from "./types";

/**
 * Asks the AI for a short plain-text progress summary of a project.
 * Any project member, including viewers, may request one — nothing is saved.
 */
export function summarizeProject(
  request: AuthedRequest,
  projectId: string,
): Promise<string> {
  return request<{ summary: string }>(`/projects/${projectId}/ai/summary`, {
    method: "POST",
  }).then((response) => response.summary);
}

/**
 * Turns a free-text note into draft tasks. The drafts are returned for the
 * user to review and edit — nothing is created until they post real tasks.
 */
export function generateTaskDrafts(
  request: AuthedRequest,
  projectId: string,
  text: string,
): Promise<TaskDraft[]> {
  return request<{ drafts: TaskDraft[] }>(`/projects/${projectId}/ai/tasks`, {
    method: "POST",
    body: { text },
  }).then((response) => response.drafts);
}
