import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, type AuthedRequest } from "@/lib/api";
import type { Subtask } from "@/lib/types";

import { SubtaskList } from "./subtask-list";

const requestMock = vi.fn();
const request = requestMock as unknown as AuthedRequest;

const SUBTASKS: Subtask[] = [
  {
    id: "st1",
    task_id: "t1",
    title: "First subtask",
    is_done: false,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "st2",
    task_id: "t1",
    title: "Second subtask",
    is_done: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

interface MockOptions {
  method?: string;
  body?: { title?: string };
}

function stubRequests(
  overrides: { subtasks?: Subtask[]; suggestions?: string[] } = {},
) {
  const subtasks = overrides.subtasks ?? SUBTASKS;
  const suggestions = overrides.suggestions ?? ["AI subtask one", "AI subtask two"];

  requestMock.mockImplementation((path: string, options?: MockOptions) => {
    if (path.endsWith("/subtasks/generate") && options?.method === "POST") {
      return Promise.resolve({ suggestions });
    }
    if (path.endsWith("/subtasks") && !options) {
      return Promise.resolve(subtasks);
    }
    if (path.endsWith("/subtasks") && options?.method === "POST") {
      return Promise.resolve({
        id: `new-${Math.random()}`,
        task_id: "t1",
        title: options.body?.title ?? "",
        is_done: false,
        created_at: "2026-01-01T00:00:00Z",
      });
    }
    if (options?.method === "PATCH") {
      return Promise.resolve({ ...SUBTASKS[0], is_done: true });
    }
    if (options?.method === "DELETE") {
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`unexpected request: ${path}`));
  });
}

afterEach(() => {
  requestMock.mockReset();
});

describe("SubtaskList", () => {
  it("renders existing subtasks with a progress count", async () => {
    stubRequests();
    render(<SubtaskList request={request} taskId="t1" />);

    expect(await screen.findByText("First subtask")).toBeInTheDocument();
    expect(screen.getByText("Second subtask")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 done")).toBeInTheDocument();
  });

  it("toggles a subtask's done state", async () => {
    stubRequests();
    render(<SubtaskList request={request} taskId="t1" />);
    await screen.findByText("First subtask");

    await userEvent.click(
      screen.getByRole("checkbox", { name: "First subtask" }),
    );

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1/subtasks/st1",
        expect.objectContaining({
          method: "PATCH",
          body: { is_done: true },
        }),
      ),
    );
  });

  it("adds a subtask manually", async () => {
    stubRequests({ subtasks: [] });
    render(<SubtaskList request={request} taskId="t1" />);
    await screen.findByLabelText("New subtask title");

    await userEvent.type(
      screen.getByLabelText("New subtask title"),
      "Buy milk",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1/subtasks",
        expect.objectContaining({
          method: "POST",
          body: { title: "Buy milk" },
        }),
      ),
    );
  });

  it("deletes a subtask", async () => {
    stubRequests();
    render(<SubtaskList request={request} taskId="t1" />);
    await screen.findByText("First subtask");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete subtask: First subtask" }),
    );

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1/subtasks/st1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("generates AI suggestions and shows them for review", async () => {
    stubRequests({ subtasks: [] });
    render(<SubtaskList request={request} taskId="t1" />);
    await screen.findByLabelText("New subtask title");

    await userEvent.click(
      screen.getByRole("button", { name: /Generate with AI/i }),
    );

    expect(
      await screen.findByText("Review AI suggestions"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Edit suggestion: AI subtask one"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add 2 subtasks" }),
    ).toBeInTheDocument();
  });

  it("saves reviewed AI suggestions as subtasks", async () => {
    stubRequests({ subtasks: [] });
    render(<SubtaskList request={request} taskId="t1" />);
    await screen.findByLabelText("New subtask title");

    await userEvent.click(
      screen.getByRole("button", { name: /Generate with AI/i }),
    );
    await screen.findByText("Review AI suggestions");

    await userEvent.click(
      screen.getByRole("button", { name: "Add 2 subtasks" }),
    );

    await waitFor(() => {
      const created = requestMock.mock.calls.filter(
        ([path, options]) =>
          path === "/tasks/t1/subtasks" && options?.method === "POST",
      );
      expect(created).toHaveLength(2);
    });
  });

  it("shows a friendly error when AI generation fails", async () => {
    stubRequests({ subtasks: [] });
    requestMock.mockImplementation((path: string, options?: MockOptions) => {
      if (path.endsWith("/subtasks/generate") && options?.method === "POST") {
        return Promise.reject(
          new ApiError(502, "The AI service is unavailable. Please try again."),
        );
      }
      if (path.endsWith("/subtasks") && !options) {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    });

    render(<SubtaskList request={request} taskId="t1" />);
    await screen.findByLabelText("New subtask title");

    await userEvent.click(
      screen.getByRole("button", { name: /Generate with AI/i }),
    );

    expect(
      await screen.findByText(
        "The AI service is unavailable. Please try again.",
      ),
    ).toBeInTheDocument();
  });
});
