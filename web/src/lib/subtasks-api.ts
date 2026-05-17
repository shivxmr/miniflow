/**
 * Typed wrappers for the MiniFlow subtask endpoints (nested under a task).
 *
 * Every function takes an {@link AuthedRequest} so calls automatically carry
 * the access token and silently recover from an expired one.
 */

import type { AuthedRequest } from "./api";
import type { Subtask } from "./types";

/** Fields accepted when updating a subtask (all optional). */
export interface SubtaskUpdateInput {
  title?: string;
  is_done?: boolean;
}

/** Fetches the checklist of subtasks for a task. */
export function listSubtasks(
  request: AuthedRequest,
  taskId: string,
): Promise<Subtask[]> {
  return request<Subtask[]>(`/tasks/${taskId}/subtasks`);
}

/** Creates a single subtask under a task. */
export function createSubtask(
  request: AuthedRequest,
  taskId: string,
  title: string,
): Promise<Subtask> {
  return request<Subtask>(`/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: { title },
  });
}

/** Toggles `is_done` and/or renames a subtask. */
export function updateSubtask(
  request: AuthedRequest,
  taskId: string,
  subtaskId: string,
  input: SubtaskUpdateInput,
): Promise<Subtask> {
  return request<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: "PATCH",
    body: input,
  });
}

/** Permanently deletes a subtask. */
export function deleteSubtask(
  request: AuthedRequest,
  taskId: string,
  subtaskId: string,
): Promise<void> {
  return request<void>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: "DELETE",
  });
}

/**
 * Asks the AI to suggest subtasks for a task. The suggestions are returned
 * for the user to review — nothing is persisted until they are saved.
 */
export function generateSubtasks(
  request: AuthedRequest,
  taskId: string,
): Promise<string[]> {
  return request<{ suggestions: string[] }>(
    `/tasks/${taskId}/subtasks/generate`,
    { method: "POST" },
  ).then((response) => response.suggestions);
}
