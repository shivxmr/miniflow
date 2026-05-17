/**
 * Project-scoped permission helpers, mirroring the backend RBAC matrix
 * (see api/app/services/permissions.py). These gate what the UI *offers*;
 * the API independently enforces every rule, so a forced request still fails.
 */

import type { BadgeTone } from "@/components/ui/badge";
import type { Task, UserRole } from "./types";

/** Human-readable label for a role. */
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  admin: "accent",
  member: "info",
  viewer: "neutral",
};

/** The order roles are offered in selects, most privileged first. */
export const ROLE_ORDER: UserRole[] = ["admin", "member", "viewer"];

/** Badge tone used to render a role pill. */
export function roleBadgeTone(role: UserRole): BadgeTone {
  return ROLE_TONE[role];
}

/** Admins may rename or delete a project. */
export function canManageProject(role: UserRole): boolean {
  return role === "admin";
}

/** Admins may invite members, change member roles, and remove members. */
export function canManageMembers(role: UserRole): boolean {
  return role === "admin";
}

/** Admins and Members may create tasks; Viewers are read-only. */
export function canCreateTask(role: UserRole): boolean {
  return role === "admin" || role === "member";
}

/** Admins and Members may comment on tasks; Viewers are read-only. */
export function canComment(role: UserRole): boolean {
  return role === "admin" || role === "member";
}

/**
 * Returns whether the current user may delete a comment.
 * - Admins may delete any comment.
 * - Members may delete only their own.
 * - Viewers are read-only and may delete nothing.
 */
export function canDeleteComment(
  role: UserRole,
  currentUserId: string,
  commentAuthorId: string,
): boolean {
  if (role === "admin") return true;
  if (role === "member") return commentAuthorId === currentUserId;
  return false;
}

/**
 * Returns whether the current user may edit or delete a task.
 * - Admins may touch any task.
 * - Members may only touch tasks they created or are assigned to.
 * - Viewers cannot edit anything.
 */
export function canEditTask(
  role: UserRole,
  currentUserId: string,
  task: Pick<Task, "created_by" | "assigned_to">,
): boolean {
  if (role === "admin") return true;
  if (role === "member") {
    return task.created_by === currentUserId || task.assigned_to === currentUserId;
  }
  return false;
}
