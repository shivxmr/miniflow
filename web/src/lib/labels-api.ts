/**
 * Typed wrappers for the MiniFlow label endpoints.
 *
 * Label definitions are project-scoped (managed by Admins); applying and
 * removing labels on a task is allowed for any writer (Admin or Member) and
 * returns the updated {@link Task} so the caller can refresh its pills.
 */

import type { AuthedRequest } from "./api";
import type { Label, Task } from "./types";

/** Fields accepted when creating a label. */
export interface LabelCreateInput {
  name: string;
  color: string;
}

/** Fields accepted when updating a label (all optional). */
export interface LabelUpdateInput {
  name?: string;
  color?: string;
}

/** Lists a project's labels (any member may read). */
export function listLabels(
  request: AuthedRequest,
  projectId: string,
): Promise<Label[]> {
  return request<Label[]>(`/projects/${projectId}/labels`);
}

/** Creates a project label (Admin only). */
export function createLabel(
  request: AuthedRequest,
  projectId: string,
  input: LabelCreateInput,
): Promise<Label> {
  return request<Label>(`/projects/${projectId}/labels`, {
    method: "POST",
    body: input,
  });
}

/** Renames or recolors a label (Admin only). */
export function updateLabel(
  request: AuthedRequest,
  projectId: string,
  labelId: string,
  input: LabelUpdateInput,
): Promise<Label> {
  return request<Label>(`/projects/${projectId}/labels/${labelId}`, {
    method: "PUT",
    body: input,
  });
}

/** Deletes a label, removing it from all tasks (Admin only). */
export function deleteLabel(
  request: AuthedRequest,
  projectId: string,
  labelId: string,
): Promise<void> {
  return request<void>(`/projects/${projectId}/labels/${labelId}`, {
    method: "DELETE",
  });
}

/** Applies a label to a task; returns the task with its updated labels. */
export function addTaskLabel(
  request: AuthedRequest,
  taskId: string,
  labelId: string,
): Promise<Task> {
  return request<Task>(`/tasks/${taskId}/labels`, {
    method: "POST",
    body: { label_id: labelId },
  });
}

/** Removes a label from a task; returns the task with its updated labels. */
export function removeTaskLabel(
  request: AuthedRequest,
  taskId: string,
  labelId: string,
): Promise<Task> {
  return request<Task>(`/tasks/${taskId}/labels/${labelId}`, {
    method: "DELETE",
  });
}
