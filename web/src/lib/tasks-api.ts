/**
 * Typed wrappers for the MiniFlow tasks endpoints.
 *
 * Every function takes an {@link AuthedRequest} so calls automatically carry
 * the access token and silently recover from an expired one.
 */

import type { AuthedRequest } from "./api";
import type { Task, TaskListResponse, TaskPriority, TaskStatus } from "./types";

/** Fields accepted when creating a task. */
export interface TaskCreateInput {
  project_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

/** Fields accepted when updating a task (all optional). */
export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  assigned_to?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface ListTasksParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string;
  /** Filter to tasks carrying any of these labels (OR logic). */
  label_ids?: string[];
  limit?: number;
  offset?: number;
}

/** Fetches a paginated list of tasks for a project. */
export function listTasks(
  request: AuthedRequest,
  projectId: string,
  params: ListTasksParams = {},
): Promise<TaskListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.priority) qs.set("priority", params.priority);
  if (params.assigned_to) qs.set("assigned_to", params.assigned_to);
  if (params.label_ids) {
    for (const labelId of params.label_ids) qs.append("label_id", labelId);
  }
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<TaskListResponse>(
    `/projects/${projectId}/tasks${query ? `?${query}` : ""}`,
  );
}

/** Creates a new task. */
export function createTask(
  request: AuthedRequest,
  input: TaskCreateInput,
): Promise<Task> {
  return request<Task>("/tasks", { method: "POST", body: input });
}

/** Fetches a single task by id. */
export function getTask(request: AuthedRequest, taskId: string): Promise<Task> {
  return request<Task>(`/tasks/${taskId}`);
}

/** Partially updates a task. */
export function updateTask(
  request: AuthedRequest,
  taskId: string,
  input: TaskUpdateInput,
): Promise<Task> {
  return request<Task>(`/tasks/${taskId}`, { method: "PUT", body: input });
}

/** Permanently deletes a task. */
export function deleteTask(
  request: AuthedRequest,
  taskId: string,
): Promise<void> {
  return request<void>(`/tasks/${taskId}`, { method: "DELETE" });
}
