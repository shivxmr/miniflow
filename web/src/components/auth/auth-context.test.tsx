import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSession, saveSession } from "@/lib/token-store";
import { AuthProvider, useAuth } from "./auth-context";

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADA = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  role: "member",
  created_at: "2026-01-01T00:00:00Z",
};

/** A test consumer that exposes auth state and actions to the DOM. */
function AuthProbe() {
  const { user, status, login, signup, logout } = useAuth();
  const [error, setError] = useState("");

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? "none"}</span>
      <span data-testid="error">{error}</span>
      <button
        onClick={async () => {
          try {
            await login({ email: "ada@example.com", password: "secret12" });
          } catch (caught) {
            setError((caught as Error).message);
          }
        }}
      >
        login
      </button>
      <button
        onClick={async () => {
          try {
            await signup({
              name: "Ada",
              email: "ada@example.com",
              password: "secret12",
            });
          } catch (caught) {
            setError((caught as Error).message);
          }
        }}
      >
        signup
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AuthProvider", () => {
  it("settles to unauthenticated when no session is stored", async () => {
    vi.stubGlobal("fetch", vi.fn());

    renderAuth();

    expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("logs in, persists the session, and exposes the user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/login")) {
          return Promise.resolve(
            jsonResponse({
              access_token: "access-1",
              refresh_token: "refresh-1",
              token_type: "bearer",
            }),
          );
        }
        if (url.endsWith("/me")) {
          return Promise.resolve(jsonResponse(ADA));
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    renderAuth();
    await screen.findByText("unauthenticated");
    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(await screen.findByTestId("user")).toHaveTextContent(
      "ada@example.com",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(loadSession()).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("surfaces an error and stays unauthenticated when login fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ detail: "Invalid email or password" }, 401),
        ),
      ),
    );

    renderAuth();
    await screen.findByText("unauthenticated");
    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(await screen.findByTestId("error")).toHaveTextContent(
      "Invalid email or password",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(loadSession()).toBeNull();
  });

  it("restores an authenticated session from storage on mount", async () => {
    saveSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/me")) {
          return Promise.resolve(jsonResponse({ ...ADA, role: "admin" }));
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("ada@example.com"),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("silently refreshes an expired access token on mount", async () => {
    saveSession({ accessToken: "expired", refreshToken: "refresh-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        if (url.endsWith("/me")) {
          const auth = new Headers(init.headers).get("Authorization");
          return Promise.resolve(
            auth === "Bearer expired"
              ? jsonResponse({ detail: "Could not validate credentials" }, 401)
              : jsonResponse(ADA),
          );
        }
        if (url.endsWith("/refresh")) {
          return Promise.resolve(
            jsonResponse({
              access_token: "fresh",
              refresh_token: "refresh-2",
              token_type: "bearer",
            }),
          );
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("ada@example.com"),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(loadSession()).toEqual({
      accessToken: "fresh",
      refreshToken: "refresh-2",
    });
  });

  it("clears the session when the stored tokens are rejected", async () => {
    saveSession({ accessToken: "bad", refreshToken: "bad" });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/me")) {
          return Promise.resolve(jsonResponse({ detail: "expired" }, 401));
        }
        if (url.endsWith("/refresh")) {
          return Promise.resolve(
            jsonResponse({ detail: "Invalid refresh token" }, 401),
          );
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent(
        "unauthenticated",
      ),
    );
    expect(loadSession()).toBeNull();
  });

  it("logs out, clearing the session and user", async () => {
    saveSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/me")) {
          return Promise.resolve(jsonResponse(ADA));
        }
        if (url.endsWith("/logout")) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    renderAuth();
    await screen.findByText("ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent(
        "unauthenticated",
      ),
    );
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(loadSession()).toBeNull();
  });

  it("signs up and lands authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/signup")) {
          return Promise.resolve(jsonResponse(ADA, 201));
        }
        if (url.endsWith("/login")) {
          return Promise.resolve(
            jsonResponse({
              access_token: "access-1",
              refresh_token: "refresh-1",
              token_type: "bearer",
            }),
          );
        }
        if (url.endsWith("/me")) {
          return Promise.resolve(jsonResponse(ADA));
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    renderAuth();
    await screen.findByText("unauthenticated");
    await userEvent.click(screen.getByRole("button", { name: "signup" }));

    expect(await screen.findByTestId("user")).toHaveTextContent(
      "ada@example.com",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("throws when useAuth is used outside a provider", () => {
    function Orphan() {
      useAuth();
      return null;
    }

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/AuthProvider/);
    consoleError.mockRestore();
  });
});

/** A consumer that performs an authenticated request via `useAuth().request`. */
function RequestProbe() {
  const { request, status } = useAuth();
  const [count, setCount] = useState(-1);
  return (
    <div>
      <span data-testid="req-status">{status}</span>
      <span data-testid="req-count">{count}</span>
      <button
        onClick={async () => {
          const projects = await request<unknown[]>("/projects");
          setCount(projects.length);
        }}
      >
        load projects
      </button>
    </div>
  );
}

describe("AuthProvider request()", () => {
  it("attaches the access token to an authenticated request", async () => {
    saveSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/me")) {
        return Promise.resolve(jsonResponse(ADA));
      }
      if (url.endsWith("/projects")) {
        return Promise.resolve(jsonResponse([{ id: "p1" }]));
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <RequestProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("req-status")).toHaveTextContent(
        "authenticated",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "load projects" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("req-count")).toHaveTextContent("1"),
    );

    const projectsCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/projects"),
    ) as unknown as [string, RequestInit] | undefined;
    const headers = new Headers(projectsCall?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-1");
  });
});
