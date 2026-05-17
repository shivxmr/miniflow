/**
 * Typed wrappers for the MiniFlow AI endpoints.
 *
 * Every function takes an {@link AuthedRequest} so calls automatically carry
 * the access token and silently recover from an expired one.
 */

import type { AuthedRequest } from "./api";

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
