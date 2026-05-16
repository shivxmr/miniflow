import { describe, expect, it } from "vitest";

import {
  ROLE_LABEL,
  ROLE_ORDER,
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
});
