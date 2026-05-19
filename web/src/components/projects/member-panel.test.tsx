import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectMember } from "@/lib/types";

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

import { MemberPanel } from "./member-panel";

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

/** Routes member requests to canned responses keyed by path + method. */
function stubRequests() {
  requestMock.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (path.startsWith("/projects/p1/members") && !options) {
        return Promise.resolve({ items: MEMBERS, total: MEMBERS.length, limit: 50, offset: 0 });
      }
      if (path === "/projects/p1/members" && options?.method === "POST") {
        return Promise.resolve(MEMBERS[1]);
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    },
  );
}

afterEach(() => {
  requestMock.mockReset();
  showToastMock.mockReset();
});

describe("MemberPanel", () => {
  it("lists the project members", async () => {
    stubRequests();
    render(<MemberPanel projectId="p1" viewerRole="admin" />);

    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("Vic Viewer")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("shows the invite form and per-member controls to an admin", async () => {
    stubRequests();
    render(<MemberPanel projectId="p1" viewerRole="admin" />);
    await screen.findByText("Ada Admin");

    expect(screen.getByLabelText("Invite by email")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("hides management controls from a viewer", async () => {
    stubRequests();
    render(<MemberPanel projectId="p1" viewerRole="viewer" />);
    await screen.findByText("Ada Admin");

    expect(
      screen.queryByLabelText("Invite by email"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("invites a member by email and reports success", async () => {
    stubRequests();
    render(<MemberPanel projectId="p1" viewerRole="admin" />);
    await screen.findByText("Ada Admin");

    await userEvent.type(
      screen.getByLabelText("Invite by email"),
      "new@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith("/projects/p1/members", {
        method: "POST",
        body: { email: "new@example.com", role: "member" },
      }),
    );
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success" }),
    );
  });

  it("rejects an invalid invite email without calling the API", async () => {
    stubRequests();
    render(<MemberPanel projectId="p1" viewerRole="admin" />);
    await screen.findByText("Ada Admin");
    requestMock.mockClear();

    await userEvent.type(screen.getByLabelText("Invite by email"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(
      screen.getByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(requestMock).not.toHaveBeenCalled();
  });
});
