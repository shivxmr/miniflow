/**
 * Typed wrappers for the MiniFlow project, member, and task-list endpoints.
 *
 * Every function takes an {@link AuthedRequest} — the token-aware request
 * helper from `useAuth().request` — so calls automatically carry the access
 * token and recover from an expired one.
 */

import type { AuthedRequest } from "./api";
import type { Project, ProjectMember, UserRole } from "./types";

export interface MemberListResponse {
  items: ProjectMember[];
  total: number;
  limit: number;
  offset: number;
}

/** Fields accepted when creating or updating a project. */
export interface ProjectInput {
  name: string;
  description: string | null;
}

/** Lists every project the caller is a member of. */
export function listProjects(request: AuthedRequest): Promise<Project[]> {
  return request<Project[]>("/projects");
}

/** Loads a single project the caller belongs to. */
export function getProject(
  request: AuthedRequest,
  projectId: string,
): Promise<Project> {
  return request<Project>(`/projects/${projectId}`);
}

/** Creates a project; the caller becomes its first Admin. */
export function createProject(
  request: AuthedRequest,
  input: ProjectInput,
): Promise<Project> {
  return request<Project>("/projects", { method: "POST", body: input });
}

/** Renames or re-describes a project (Admin only). */
export function updateProject(
  request: AuthedRequest,
  projectId: string,
  input: ProjectInput,
): Promise<Project> {
  return request<Project>(`/projects/${projectId}`, {
    method: "PUT",
    body: input,
  });
}

/** Permanently deletes a project and its tasks (Admin only). */
export function deleteProject(
  request: AuthedRequest,
  projectId: string,
): Promise<void> {
  return request<void>(`/projects/${projectId}`, { method: "DELETE" });
}

/** Lists the members of a project (paginated; default limit 50). */
export function listMembers(
  request: AuthedRequest,
  projectId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<MemberListResponse> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return request<MemberListResponse>(`/projects/${projectId}/members${query}`);
}

/** Adds an existing user (looked up by email) to a project (Admin only). */
export function addMember(
  request: AuthedRequest,
  projectId: string,
  input: { email: string; role: UserRole },
): Promise<ProjectMember> {
  return request<ProjectMember>(`/projects/${projectId}/members`, {
    method: "POST",
    body: input,
  });
}

/** Changes a member's role within a project (Admin only). */
export function updateMemberRole(
  request: AuthedRequest,
  projectId: string,
  userId: string,
  role: UserRole,
): Promise<ProjectMember> {
  return request<ProjectMember>(`/projects/${projectId}/members/${userId}`, {
    method: "PUT",
    body: { role },
  });
}

/** Removes a member from a project (Admin only). */
export function removeMember(
  request: AuthedRequest,
  projectId: string,
  userId: string,
): Promise<void> {
  return request<void>(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}
