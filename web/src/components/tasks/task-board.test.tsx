import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectMember, Task, TaskListResponse } from "@/lib/types";

const { requestMock, showToastMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("@/components/auth/auth-context", () => ({
  useAuth: () => ({ request: requestMock, user: { id: "u-admin" } }),
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

import { TaskBoard } from "./task-board";

const MEMBERS: ProjectMember[] = [
  {
    id: "m1",
    project_id: "p1",
    role: "admin",
    user: {
      id: "u-admin",
      name: "Ada Admin",
      email: "ada@example.com",
      role: "admin",
      created_at: "2026-01-01T00:00:00Z",
    },
  },
  {
    id: "m2",
    project_id: "p1",
    role: "viewer",
    user: {
      id: "u-vic",
      name: "Vic Viewer",
      email: "vic@example.com",
      role: "viewer",
      created_at: "2026-01-01T00:00:00Z",
    },
  },
];

const TASKS: Task[] = [
  {
    id: "t1",
    project_id: "p1",
    title: "Todo task",
    description: null,
    assigned_to: null,
    status: "todo",
    priority: "medium",
    due_date: null,
    created_by: "u-admin",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "t2",
    project_id: "p1",
    title: "In progress task",
    description: "Doing it now",
    assigned_to: "u-admin",
    status: "in_progress",
    priority: "high",
    due_date: "2026-06-01",
    created_by: "u-admin",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "t3",
    project_id: "p1",
    title: "Done task",
    description: null,
    assigned_to: null,
    status: "done",
    priority: "low",
    due_date: null,
    created_by: "u-other",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const TASK_LIST_RESPONSE: TaskListResponse = {
  items: TASKS,
  total: 3,
  limit: 100,
  offset: 0,
};

function stubRequests(
  overrides: { tasks?: TaskListResponse; members?: ProjectMember[] } = {},
) {
  const tasks = overrides.tasks ?? TASK_LIST_RESPONSE;
  const membersItems = overrides.members ?? MEMBERS;
  const members = { items: membersItems, total: membersItems.length, limit: 50, offset: 0 };

  requestMock.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (path.includes("/subtasks") && !options) {
        return Promise.resolve([]);
      }
      if (path.includes("/tasks") && !options) {
        return Promise.resolve(tasks);
      }
      if (path.includes("/members") && !options) {
        return Promise.resolve(members);
      }
      if (path === "/tasks" && options?.method === "POST") {
        return Promise.resolve({ ...TASKS[0], id: "t-new", title: "New task" });
      }
      if (path.match(/\/tasks\/.+/) && options?.method === "PUT") {
        return Promise.resolve(TASKS[0]);
      }
      if (path.match(/\/tasks\/.+/) && options?.method === "DELETE") {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    },
  );
}

afterEach(() => {
  requestMock.mockReset();
  showToastMock.mockReset();
});

describe("TaskBoard", () => {
  it("renders three Kanban columns with tasks in them", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);

    expect(await screen.findByText("Todo task")).toBeInTheDocument();
    expect(screen.getByText("In progress task")).toBeInTheDocument();
    expect(screen.getByText("Done task")).toBeInTheDocument();

    // Column headers
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows a 'New task' button for admin/member roles", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    expect(screen.getByRole("button", { name: "New task" })).toBeInTheDocument();
  });

  it("hides the 'New task' button for viewers", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="viewer" />);
    await screen.findByText("Todo task");

    expect(
      screen.queryByRole("button", { name: "New task" }),
    ).not.toBeInTheDocument();
  });

  it("shows edit/delete buttons only for tasks the user can modify (admin sees all)", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    // Admin can edit all — 3 tasks, each with an edit button
    const editButtons = screen.getAllByRole("button", { name: /Edit task:/i });
    expect(editButtons).toHaveLength(3);
  });

  it("as a member, only shows edit/delete for own tasks (created_by or assigned_to)", async () => {
    // u-admin is logged in. TASKS[0] created_by=u-admin, TASKS[1] assigned_to=u-admin, TASKS[2] neither.
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="member" />);
    await screen.findByText("Todo task");

    // Should see edit for t1 and t2, not t3
    const editButtons = screen.getAllByRole("button", { name: /Edit task:/i });
    expect(editButtons).toHaveLength(2);
  });

  it("creates a task and shows a success toast", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    await userEvent.click(screen.getByRole("button", { name: "New task" }));
    expect(
      screen.getByRole("heading", { name: "New task" }),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Title"), "Brand new task");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success" }),
    );
  });

  it("opens the edit modal pre-filled and submits an update", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    // Click Edit on the first task (Todo task)
    const editButtons = screen.getAllByRole("button", {
      name: "Edit task: Todo task",
    });
    await userEvent.click(editButtons[0]);

    // The modal should be open and pre-filled
    expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Todo task");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success" }),
    );
  });

  it("opens a confirm dialog before deleting a task", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    const deleteButtons = screen.getAllByRole("button", {
      name: "Delete task: Todo task",
    });
    await userEvent.click(deleteButtons[0]);

    // ConfirmDialog should be visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Delete "Todo task"/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete task" }),
    );

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success" }),
    );
  });

  it("switches to list view and shows all tasks in a flat list", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    await userEvent.click(screen.getByRole("button", { name: /List/i }));

    // In list view, rows are shown
    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(3);
  });

  it("shows empty-column placeholders when a column has no tasks", async () => {
    const emptyTasks: TaskListResponse = { items: [], total: 0, limit: 100, offset: 0 };
    stubRequests({ tasks: emptyTasks });
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("No tasks to do yet.");

    expect(screen.getByText("Nothing in progress.")).toBeInTheDocument();
    expect(screen.getByText("No completed tasks yet.")).toBeInTheDocument();
  });

  it("opens the AI task-draft modal from the toolbar", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="admin" />);
    await screen.findByText("Todo task");

    await userEvent.click(
      screen.getByRole("button", { name: /Draft with AI/i }),
    );

    expect(screen.getByLabelText("Describe the work")).toBeInTheDocument();
  });

  it("hides the AI task-draft button for viewers", async () => {
    stubRequests();
    render(<TaskBoard projectId="p1" viewerRole="viewer" />);
    await screen.findByText("Todo task");

    expect(
      screen.queryByRole("button", { name: /Draft with AI/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the error state when the task fetch fails", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/members")) return Promise.resolve({ items: MEMBERS, total: MEMBERS.length, limit: 50, offset: 0 });
      return Promise.reject(new Error("Network error"));
    });
    render(<TaskBoard projectId="p1" viewerRole="admin" />);

    expect(await screen.findByText("Could not load tasks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
