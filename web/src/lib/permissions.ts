/**
 * Project-scoped permission helpers, mirroring the backend RBAC matrix
 * (see api/app/services/permissions.py). These gate what the UI *offers*;
 * the API independently enforces every rule, so a forced request still fails.
 */

import type { BadgeTone } from "@/components/ui/badge";
import type { UserRole } from "./types";

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
