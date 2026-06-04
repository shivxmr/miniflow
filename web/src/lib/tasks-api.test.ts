import { describe, expect, it, vi } from "vitest";

import type { AuthedRequest } from "./api";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "./tasks-api";

function spy() {
  const fn = vi.fn().mockResolvedValue(undefined);
  return { fn, request: fn as unknown as AuthedRequest };
}

describe("tasks-api", () => {
  it("listTasks GETs the tasks collection without params", () => {
    const { fn, request } = spy();
    listTasks(request, "p1");
    expect(fn).toHaveBeenCalledWith("/projects/p1/tasks");
  });

  it("listTasks appends query params when provided", () => {
    const { fn, request } = spy();
    listTasks(request, "p1", { status: "todo", priority: "high", limit: 20, offset: 10 });
    expect(fn).toHaveBeenCalledWith(
      "/projects/p1/tasks?status=todo&priority=high&limit=20&offset=10",
    );
  });

  it("listTasks appends a label_id param for each label (OR filter)", () => {
    const { fn, request } = spy();
    listTasks(request, "p1", { label_ids: ["a", "b"] });
    expect(fn).toHaveBeenCalledWith("/projects/p1/tasks?label_id=a&label_id=b");
  });

  it("createTask POSTs the task body", () => {
    const { fn, request } = spy();
    createTask(request, {
      project_id: "p1",
      title: "New task",
      status: "todo",
      priority: "medium",
    });
    expect(fn).toHaveBeenCalledWith("/tasks", {
      method: "POST",
      body: { project_id: "p1", title: "New task", status: "todo", priority: "medium" },
    });
  });

  it("getTask GETs a single task", () => {
    const { fn, request } = spy();
    getTask(request, "t1");
    expect(fn).toHaveBeenCalledWith("/tasks/t1");
  });

  it("updateTask PUTs the update body", () => {
    const { fn, request } = spy();
    updateTask(request, "t1", { title: "Updated", status: "done" });
    expect(fn).toHaveBeenCalledWith("/tasks/t1", {
      method: "PUT",
      body: { title: "Updated", status: "done" },
    });
  });

  it("deleteTask DELETEs the task", () => {
    const { fn, request } = spy();
    deleteTask(request, "t1");
    expect(fn).toHaveBeenCalledWith("/tasks/t1", { method: "DELETE" });
  });
});
