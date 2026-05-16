import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProjectMember, Task } from "@/lib/types";
import { TaskFormModal } from "./task-form-modal";

const MEMBERS: ProjectMember[] = [
  {
    id: "m1",
    project_id: "p1",
    role: "admin",
    user: {
      id: "u1",
      name: "Alice Admin",
      email: "alice@example.com",
      role: "admin",
      created_at: "2026-01-01T00:00:00Z",
    },
  },
  {
    id: "m2",
    project_id: "p1",
    role: "member",
    user: {
      id: "u2",
      name: "Bob Member",
      email: "bob@example.com",
      role: "member",
      created_at: "2026-01-01T00:00:00Z",
    },
  },
];

const TASK: Task = {
  id: "t1",
  project_id: "p1",
  title: "Fix the bug",
  description: "It is bad",
  assigned_to: "u1",
  status: "in_progress",
  priority: "high",
  due_date: "2026-06-01",
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("TaskFormModal — create mode", () => {
  it("renders empty fields and submits valid input", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <TaskFormModal
        open
        mode="create"
        projectId="p1"
        members={MEMBERS}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New task" }),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Title"), "My new task");
    await userEvent.click(
      screen.getByRole("button", { name: "Create task" }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: "p1",
          title: "My new task",
          status: "todo",
          priority: "medium",
        }),
      ),
    );
  });

  it("shows an error when the title is empty", async () => {
    const onSubmit = vi.fn();
    render(
      <TaskFormModal
        open
        mode="create"
        projectId="p1"
        members={MEMBERS}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Create task" }),
    );

    expect(
      await screen.findByText("Task title is required"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows assignee options including 'Unassigned'", async () => {
    render(
      <TaskFormModal
        open
        mode="create"
        projectId="p1"
        members={MEMBERS}
        onClose={() => {}}
        onSubmit={vi.fn()}
      />,
    );

    const assigneeSelect = screen.getByLabelText("Assignee");
    expect(assigneeSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alice Admin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob Member" })).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(
      <TaskFormModal
        open
        mode="create"
        projectId="p1"
        members={MEMBERS}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TaskFormModal — edit mode", () => {
  it("pre-fills form fields from the initial task", () => {
    render(
      <TaskFormModal
        open
        mode="edit"
        initial={TASK}
        members={MEMBERS}
        onClose={() => {}}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Fix the bug");
    expect(screen.getByLabelText("Description")).toHaveValue("It is bad");
  });

  it("submits updated fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskFormModal
        open
        mode="edit"
        initial={TASK}
        members={MEMBERS}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    const titleInput = screen.getByLabelText("Title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated title" }),
      ),
    );
  });

  it("surfaces a form-level error when onSubmit rejects", async () => {
    const { ApiError } = await import("@/lib/api");
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(403, "You may not edit this task"));
    render(
      <TaskFormModal
        open
        mode="edit"
        initial={TASK}
        members={MEMBERS}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText("You may not edit this task"),
    ).toBeInTheDocument();
  });
});
