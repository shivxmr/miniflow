import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, type AuthedRequest } from "@/lib/api";
import type { Comment } from "@/lib/types";

import { CommentThread } from "./comment-thread";

const requestMock = vi.fn();
const request = requestMock as unknown as AuthedRequest;

const COMMENTS: Comment[] = [
  {
    id: "c1",
    task_id: "t1",
    body: "First comment",
    created_at: "2026-01-01T00:00:00Z",
    author: { id: "u1", name: "Alice Admin" },
  },
  {
    id: "c2",
    task_id: "t1",
    body: "Second comment",
    created_at: "2026-01-02T00:00:00Z",
    author: { id: "u2", name: "Bob Member" },
  },
];

interface MockOptions {
  method?: string;
  body?: { body?: string };
}

function stubRequests(overrides: { comments?: Comment[] } = {}) {
  const comments = overrides.comments ?? COMMENTS;

  requestMock.mockImplementation((path: string, options?: MockOptions) => {
    if (path === "/tasks/t1/comments" && !options) {
      return Promise.resolve(comments);
    }
    if (path === "/tasks/t1/comments" && options?.method === "POST") {
      return Promise.resolve({
        id: `new-${Math.random()}`,
        task_id: "t1",
        body: options.body?.body ?? "",
        created_at: "2026-01-03T00:00:00Z",
        author: { id: "u1", name: "Alice Admin" },
      });
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

describe("CommentThread", () => {
  it("renders existing comments with their authors", async () => {
    stubRequests();
    render(
      <CommentThread
        request={request}
        taskId="t1"
        viewerRole="member"
        currentUserId="u1"
      />,
    );

    expect(await screen.findByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Bob Member")).toBeInTheDocument();
  });

  it("posts a new comment", async () => {
    stubRequests({ comments: [] });
    render(
      <CommentThread
        request={request}
        taskId="t1"
        viewerRole="member"
        currentUserId="u1"
      />,
    );
    await screen.findByLabelText("Write a comment");

    await userEvent.type(
      screen.getByLabelText("Write a comment"),
      "Nice work",
    );
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1/comments",
        expect.objectContaining({
          method: "POST",
          body: { body: "Nice work" },
        }),
      ),
    );
  });

  it("lets a member delete their own comment", async () => {
    stubRequests();
    render(
      <CommentThread
        request={request}
        taskId="t1"
        viewerRole="member"
        currentUserId="u1"
      />,
    );
    await screen.findByText("First comment");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete comment from Alice Admin" }),
    );

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        "/tasks/t1/comments/c1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("does not offer to delete other people's comments to a member", async () => {
    stubRequests();
    render(
      <CommentThread
        request={request}
        taskId="t1"
        viewerRole="member"
        currentUserId="u1"
      />,
    );
    await screen.findByText("Second comment");

    expect(
      screen.queryByRole("button", { name: "Delete comment from Bob Member" }),
    ).not.toBeInTheDocument();
  });

  it("hides the composer for viewers but still shows comments", async () => {
    stubRequests();
    render(
      <CommentThread
        request={request}
        taskId="t1"
        viewerRole="viewer"
        currentUserId="u3"
      />,
    );
    await screen.findByText("First comment");

    expect(screen.queryByLabelText("Write a comment")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Comment" }),
    ).not.toBeInTheDocument();
  });

  it("shows a friendly error when posting fails", async () => {
    requestMock.mockImplementation((path: string, options?: MockOptions) => {
      if (path === "/tasks/t1/comments" && !options) {
        return Promise.resolve([]);
      }
      if (path === "/tasks/t1/comments" && options?.method === "POST") {
        return Promise.reject(new ApiError(500, "Something went wrong."));
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    });

    render(
      <CommentThread
        request={request}
        taskId="t1"
        viewerRole="member"
        currentUserId="u1"
      />,
    );
    await screen.findByLabelText("Write a comment");

    await userEvent.type(
      screen.getByLabelText("Write a comment"),
      "This will fail",
    );
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));

    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
  });
});
