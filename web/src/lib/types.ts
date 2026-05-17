/** Shared API types mirroring the backend response schemas. */

export type UserRole = "admin" | "member" | "viewer";

/** A user account, as returned by `/me` and `/signup`. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

/** An access/refresh token pair, as returned by `/login` and `/refresh`. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/**
 * A project the caller belongs to. `role` is the caller's own role within
 * this project (from `project_members`), used to gate the UI.
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  role: UserRole;
}

/** A membership row joining a user to a project with a project-scoped role. */
export interface ProjectMember {
  id: string;
  project_id: string;
  role: UserRole;
  user: User;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

/** A task belonging to a project, as returned by the tasks API. */
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Paginated response from GET /projects/:id/tasks. */
export interface TaskListResponse {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
}

/** A checklist item belonging to a task. May be added manually or by AI. */
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  created_at: string;
}
