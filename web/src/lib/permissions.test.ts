import { describe, expect, it } from "vitest";

import {
  ROLE_LABEL,
  ROLE_ORDER,
  canCreateTask,
  canEditTask,
  canManageMembers,
  canManageProject,
  roleBadgeTone,
} from "./permissions";

describe("permissions", () => {
  it("only admins may manage a project", () => {
    expect(canManageProject("admin")).toBe(true);
    expect(canManageProject("member")).toBe(false);
    expect(canManageProject("viewer")).toBe(false);
  });

  it("only admins may manage members", () => {
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("member")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);
  });

  it("labels every role", () => {
    expect(ROLE_LABEL.admin).toBe("Admin");
    expect(ROLE_LABEL.member).toBe("Member");
    expect(ROLE_LABEL.viewer).toBe("Viewer");
  });

  it("orders roles most-privileged first", () => {
    expect(ROLE_ORDER).toEqual(["admin", "member", "viewer"]);
  });

  it("maps each role to a badge tone", () => {
    expect(roleBadgeTone("admin")).toBe("accent");
    expect(roleBadgeTone("member")).toBe("info");
    expect(roleBadgeTone("viewer")).toBe("neutral");
  });

  it("admins and members may create tasks; viewers cannot", () => {
    expect(canCreateTask("admin")).toBe(true);
    expect(canCreateTask("member")).toBe(true);
    expect(canCreateTask("viewer")).toBe(false);
  });

  describe("canEditTask", () => {
    const ownTask = { created_by: "u1", assigned_to: null };
    const assignedTask = { created_by: "u2", assigned_to: "u1" };
    const othersTask = { created_by: "u2", assigned_to: null };

    it("admins may edit any task", () => {
      expect(canEditTask("admin", "u1", othersTask)).toBe(true);
    });

    it("members may edit tasks they created", () => {
      expect(canEditTask("member", "u1", ownTask)).toBe(true);
    });

    it("members may edit tasks assigned to them", () => {
      expect(canEditTask("member", "u1", assignedTask)).toBe(true);
    });

    it("members cannot edit other people's tasks", () => {
      expect(canEditTask("member", "u1", othersTask)).toBe(false);
    });

    it("viewers cannot edit any task", () => {
      expect(canEditTask("viewer", "u1", ownTask)).toBe(false);
    });
  });
});
