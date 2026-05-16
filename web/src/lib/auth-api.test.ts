import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchCurrentUser,
  login,
  logout,
  refreshSession,
  signup,
} from "./auth-api";

function mockFetch() {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth API", () => {
  it("signup POSTs the new account to /signup", async () => {
    const fetchMock = mockFetch();

    await signup({ name: "Ada", email: "ada@example.com", password: "secret12" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/signup");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      password: "secret12",
    });
  });

  it("login POSTs credentials to /login", async () => {
    const fetchMock = mockFetch();

    await login({ email: "ada@example.com", password: "secret12" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "ada@example.com",
      password: "secret12",
    });
  });

  it("refreshSession POSTs the refresh token to /refresh", async () => {
    const fetchMock = mockFetch();

    await refreshSession("refresh-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/refresh");
    expect(JSON.parse(init.body as string)).toEqual({
      refresh_token: "refresh-1",
    });
  });

  it("logout POSTs the refresh token with the access token attached", async () => {
    const fetchMock = mockFetch();

    await logout("refresh-1", "access-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/logout");
    expect(JSON.parse(init.body as string)).toEqual({
      refresh_token: "refresh-1",
    });
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer access-1",
    );
  });

  it("fetchCurrentUser GETs /me with the access token", async () => {
    const fetchMock = mockFetch();

    await fetchCurrentUser("access-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/me");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer access-1",
    );
  });
});
