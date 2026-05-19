import { describe, expect, it, vi } from "vitest";

import type { AuthedRequest } from "./api";
import {
  addMember,
  createProject,
  deleteProject,
  getProject,
  listMembers,
  listProjects,
  removeMember,
  updateMemberRole,
  updateProject,
} from "./projects-api";

/** A request spy typed loosely enough to pass as an `AuthedRequest`. */
function spy() {
  const fn = vi.fn().mockResolvedValue(undefined);
  return { fn, request: fn as unknown as AuthedRequest };
}

describe("projects-api", () => {
  it("listProjects GETs /projects", () => {
    const { fn, request } = spy();
    listProjects(request);
    expect(fn).toHaveBeenCalledWith("/projects");
  });

  it("getProject GETs a single project", () => {
    const { fn, request } = spy();
    getProject(request, "p1");
    expect(fn).toHaveBeenCalledWith("/projects/p1");
  });

  it("createProject POSTs the project body", () => {
    const { fn, request } = spy();
    createProject(request, { name: "Site", description: "x" });
    expect(fn).toHaveBeenCalledWith("/projects", {
      method: "POST",
      body: { name: "Site", description: "x" },
    });
  });

  it("updateProject PUTs the project body", () => {
    const { fn, request } = spy();
    updateProject(request, "p1", { name: "Renamed", description: null });
    expect(fn).toHaveBeenCalledWith("/projects/p1", {
      method: "PUT",
      body: { name: "Renamed", description: null },
    });
  });

  it("deleteProject DELETEs the project", () => {
    const { fn, request } = spy();
    deleteProject(request, "p1");
    expect(fn).toHaveBeenCalledWith("/projects/p1", { method: "DELETE" });
  });

  it("listMembers GETs the members collection", () => {
    const { fn, request } = spy();
    listMembers(request, "p1");
    expect(fn).toHaveBeenCalledWith("/projects/p1/members");
  });

  it("listMembers appends limit and offset when provided", () => {
    const { fn, request } = spy();
    listMembers(request, "p1", { limit: 10, offset: 20 });
    expect(fn).toHaveBeenCalledWith("/projects/p1/members?limit=10&offset=20");
  });

  it("addMember POSTs an email and role", () => {
    const { fn, request } = spy();
    addMember(request, "p1", { email: "new@x.com", role: "member" });
    expect(fn).toHaveBeenCalledWith("/projects/p1/members", {
      method: "POST",
      body: { email: "new@x.com", role: "member" },
    });
  });

  it("updateMemberRole PUTs the new role for a user", () => {
    const { fn, request } = spy();
    updateMemberRole(request, "p1", "u2", "admin");
    expect(fn).toHaveBeenCalledWith("/projects/p1/members/u2", {
      method: "PUT",
      body: { role: "admin" },
    });
  });

  it("removeMember DELETEs the membership", () => {
    const { fn, request } = spy();
    removeMember(request, "p1", "u2");
    expect(fn).toHaveBeenCalledWith("/projects/p1/members/u2", {
      method: "DELETE",
    });
  });
});
