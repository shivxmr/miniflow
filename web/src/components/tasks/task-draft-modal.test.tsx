import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, type AuthedRequest } from "@/lib/api";

import { TaskDraftModal } from "./task-draft-modal";

const requestMock = vi.fn();
const request = requestMock as unknown as AuthedRequest;

const DRAFTS = [
  {
    title: "Build login form",
    description: "Email and password fields",
    priority: "high",
  },
  { title: "Add API route", description: "POST /login", priority: "medium" },
];

interface MockOptions {
  method?: string;
  body?: Record<string, unknown>;
}

function stubRequests(drafts: typeof DRAFTS = DRAFTS) {
  requestMock.mockImplementation((path: string, options?: MockOptions) => {
    if (path.endsWith("/ai/tasks") && options?.method === "POST") {
      return Promise.resolve({ drafts });
    }
    if (path === "/tasks" && options?.method === "POST") {
      return Promise.resolve({ id: `t-${Math.random()}`, ...options.body });
    }
    return Promise.reject(new Error(`unexpected request: ${path}`));
  });
}

function renderModal(onCreated = vi.fn(), onClose = vi.fn()) {
  render(
    <TaskDraftModal
      open
      onClose={onClose}
      request={request}
      projectId="p1"
      onCreated={onCreated}
    />,
  );
  return { onCreated, onClose };
}

afterEach(() => {
  requestMock.mockReset();
});

describe("TaskDraftModal", () => {
  it("shows a textarea and a generate button when opened", () => {
    stubRequests();
    renderModal();

    expect(screen.getByLabelText("Describe the work")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generate tasks/i }),
    ).toBeInTheDocument();
  });

  it("generates drafts and shows an editable review list", async () => {
    stubRequests();
    renderModal();

    await userEvent.type(
      screen.getByLabelText("Describe the work"),
      "Build a login page",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Generate tasks/i }),
    );

    expect(
      await screen.findByLabelText("Edit draft title: Build login form"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Edit draft title: Add API route"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add 2 tasks" }),
    ).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith("/projects/p1/ai/tasks", {
      method: "POST",
      body: { text: "Build a login page" },
    });
  });

  it("creates the kept drafts as real tasks and reports the count", async () => {
    stubRequests();
    const { onCreated } = renderModal();

    await userEvent.type(
      screen.getByLabelText("Describe the work"),
      "Build a login page",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Generate tasks/i }),
    );
    await screen.findByLabelText("Edit draft title: Build login form");

    await userEvent.click(screen.getByRole("button", { name: "Add 2 tasks" }));

    await waitFor(() => {
      const created = requestMock.mock.calls.filter(
        ([path, options]) => path === "/tasks" && options?.method === "POST",
      );
      expect(created).toHaveLength(2);
    });
    expect(onCreated).toHaveBeenCalledWith(2);
  });

  it("excludes an unchecked draft from creation", async () => {
    stubRequests();
    renderModal();

    await userEvent.type(
      screen.getByLabelText("Describe the work"),
      "Build a login page",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Generate tasks/i }),
    );
    await screen.findByLabelText("Edit draft title: Build login form");

    await userEvent.click(
      screen.getByLabelText("Keep draft: Build login form"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add 1 task" }));

    await waitFor(() => {
      const created = requestMock.mock.calls.filter(
        ([path, options]) => path === "/tasks" && options?.method === "POST",
      );
      expect(created).toHaveLength(1);
      expect(created[0][1].body.title).toBe("Add API route");
    });
  });

  it("shows a friendly error when generation fails", async () => {
    requestMock.mockImplementation((path: string, options?: MockOptions) => {
      if (path.endsWith("/ai/tasks") && options?.method === "POST") {
        return Promise.reject(
          new ApiError(502, "The AI service is unavailable. Please try again."),
        );
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    });
    renderModal();

    await userEvent.type(
      screen.getByLabelText("Describe the work"),
      "Build a login page",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Generate tasks/i }),
    );

    expect(
      await screen.findByText(
        "The AI service is unavailable. Please try again.",
      ),
    ).toBeInTheDocument();
  });
});
