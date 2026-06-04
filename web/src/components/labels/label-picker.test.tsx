import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { AuthedRequest } from "@/lib/api";
import type { Label, Task } from "@/lib/types";

import { LabelPicker } from "./label-picker";

const PROJECT_LABELS: Label[] = [
  { id: "l1", project_id: "p1", name: "bug", color: "#E11D48" },
  { id: "l2", project_id: "p1", name: "chore", color: "#2563EB" },
];

function makeTask(labels: Label[]): Task {
  return {
    id: "t1",
    project_id: "p1",
    title: "Task",
    description: null,
    assigned_to: null,
    status: "todo",
    priority: "medium",
    due_date: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    labels,
  };
}

function renderPicker(task: Task) {
  const requestMock = vi.fn();
  const request = requestMock as unknown as AuthedRequest;
  const onTaskChange = vi.fn();
  render(
    <ToastProvider>
      <LabelPicker
        request={request}
        task={task}
        projectLabels={PROJECT_LABELS}
        onTaskChange={onTaskChange}
      />
    </ToastProvider>,
  );
  return { requestMock, onTaskChange };
}

describe("LabelPicker", () => {
  it("applies an unselected label and reports the updated task", async () => {
    const user = userEvent.setup();
    const task = makeTask([]);
    const { requestMock, onTaskChange } = renderPicker(task);
    const updated = makeTask([PROJECT_LABELS[0]]);
    requestMock.mockResolvedValue(updated);

    await user.click(screen.getByRole("button", { name: /labels/i }));
    await user.click(screen.getByRole("option", { name: /bug/i }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith("/tasks/t1/labels", {
        method: "POST",
        body: { label_id: "l1" },
      }),
    );
    expect(onTaskChange).toHaveBeenCalledWith(updated);
  });

  it("removes an already-applied label", async () => {
    const user = userEvent.setup();
    const task = makeTask([PROJECT_LABELS[0]]);
    const { requestMock } = renderPicker(task);
    requestMock.mockResolvedValue(makeTask([]));

    await user.click(screen.getByRole("button", { name: /labels/i }));
    await user.click(screen.getByRole("option", { name: /bug/i }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith("/tasks/t1/labels/l1", {
        method: "DELETE",
      }),
    );
  });

  it("disables unselected labels once five are applied", async () => {
    const user = userEvent.setup();
    const many: Label[] = Array.from({ length: 5 }, (_, i) => ({
      id: `x${i}`,
      project_id: "p1",
      name: `x${i}`,
      color: "#2563EB",
    }));
    const task = makeTask(many);
    const requestMock = vi.fn();
    render(
      <ToastProvider>
        <LabelPicker
          request={requestMock as unknown as AuthedRequest}
          task={task}
          projectLabels={[...many, PROJECT_LABELS[0]]}
          onTaskChange={vi.fn()}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /labels/i }));

    expect(screen.getByRole("option", { name: /bug/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
