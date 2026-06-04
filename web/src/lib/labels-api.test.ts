import { describe, expect, it, vi } from "vitest";

import type { AuthedRequest } from "./api";
import {
  addTaskLabel,
  createLabel,
  deleteLabel,
  listLabels,
  removeTaskLabel,
  updateLabel,
} from "./labels-api";

function spy() {
  const fn = vi.fn().mockResolvedValue(undefined);
  return { fn, request: fn as unknown as AuthedRequest };
}

describe("labels-api", () => {
  it("listLabels GETs the project's labels", () => {
    const { fn, request } = spy();
    listLabels(request, "p1");
    expect(fn).toHaveBeenCalledWith("/projects/p1/labels");
  });

  it("createLabel POSTs name and color", () => {
    const { fn, request } = spy();
    createLabel(request, "p1", { name: "bug", color: "#E11D48" });
    expect(fn).toHaveBeenCalledWith("/projects/p1/labels", {
      method: "POST",
      body: { name: "bug", color: "#E11D48" },
    });
  });

  it("updateLabel PUTs the changes", () => {
    const { fn, request } = spy();
    updateLabel(request, "p1", "l1", { name: "defect" });
    expect(fn).toHaveBeenCalledWith("/projects/p1/labels/l1", {
      method: "PUT",
      body: { name: "defect" },
    });
  });

  it("deleteLabel DELETEs the label", () => {
    const { fn, request } = spy();
    deleteLabel(request, "p1", "l1");
    expect(fn).toHaveBeenCalledWith("/projects/p1/labels/l1", {
      method: "DELETE",
    });
  });

  it("addTaskLabel POSTs the label id to the task", () => {
    const { fn, request } = spy();
    addTaskLabel(request, "t1", "l1");
    expect(fn).toHaveBeenCalledWith("/tasks/t1/labels", {
      method: "POST",
      body: { label_id: "l1" },
    });
  });

  it("removeTaskLabel DELETEs the task label", () => {
    const { fn, request } = spy();
    removeTaskLabel(request, "t1", "l1");
    expect(fn).toHaveBeenCalledWith("/tasks/t1/labels/l1", {
      method: "DELETE",
    });
  });
});
