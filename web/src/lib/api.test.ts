import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, normalizeError, requestWithRefresh } from "./api";

const API_BASE = "http://localhost:8000";

function mockFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeError", () => {
  it("uses a string `detail` as the message (FastAPI HTTPException)", () => {
    const error = normalizeError(401, { detail: "Invalid email or password" });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid email or password");
    expect(error.fieldErrors).toEqual({});
  });

  it("maps a 422 validation `detail` array into field errors", () => {
    const error = normalizeError(422, {
      detail: [
        {
          loc: ["body", "email"],
          msg: "value is not a valid email address",
        },
      ],
    });

    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({
      email: "value is not a valid email address",
    });
    expect(error.message).toBe("value is not a valid email address");
  });

  it("collects multiple field errors from a validation array", () => {
    const error = normalizeError(422, {
      detail: [
        { loc: ["body", "email"], msg: "invalid email" },
        { loc: ["body", "password"], msg: "too short" },
      ],
    });

    expect(error.fieldErrors).toEqual({
      email: "invalid email",
      password: "too short",
    });
  });

  it("falls back to a friendly message when the body has no detail", () => {
    expect(normalizeError(500, null).message).toBe(
      "Something went wrong. Please try again.",
    );
    expect(normalizeError(403, {}).message).toBe(
      "You do not have permission to do that.",
    );
  });
});

describe("apiFetch", () => {
  it("returns parsed JSON and prefixes the API base URL", async () => {
    const fetchMock = mockFetch(jsonResponse({ id: "u1", name: "Ada" }));

    const data = await apiFetch<{ id: string; name: string }>("/me");

    expect(data).toEqual({ id: "u1", name: "Ada" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/me`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("attaches a bearer token when one is provided", async () => {
    const fetchMock = mockFetch(jsonResponse({}));

    await apiFetch("/me", { token: "access-123" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer access-123",
    );
  });

  it("serializes a JSON body and sets the content type", async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }, 201));

    await apiFetch("/login", {
      method: "POST",
      body: { email: "ada@example.com" },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ email: "ada@example.com" }));
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("throws a normalized ApiError for a non-2xx response", async () => {
    mockFetch(jsonResponse({ detail: "Invalid email or password" }, 401));

    await expect(apiFetch("/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("resolves to undefined for a 204 No Content response", async () => {
    mockFetch(new Response(null, { status: 204 }));

    await expect(
      apiFetch("/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("wraps a network failure in an ApiError with status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/me")).rejects.toMatchObject({ status: 0 });
  });
});

describe("requestWithRefresh", () => {
  it("returns the result without refreshing when the first attempt succeeds", async () => {
    const doRequest = vi.fn().mockResolvedValue("ok");
    const refresh = vi.fn();

    const result = await requestWithRefresh(doRequest, {
      accessToken: "access-1",
      refresh,
    });

    expect(result).toBe("ok");
    expect(doRequest).toHaveBeenCalledExactlyOnceWith("access-1");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes and retries once with the new token after a 401", async () => {
    const doRequest = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, "expired"))
      .mockResolvedValueOnce("ok");
    const refresh = vi.fn().mockResolvedValue("access-2");

    const result = await requestWithRefresh(doRequest, {
      accessToken: "access-1",
      refresh,
    });

    expect(result).toBe("ok");
    expect(refresh).toHaveBeenCalledOnce();
    expect(doRequest).toHaveBeenNthCalledWith(2, "access-2");
  });

  it("rethrows the 401 when the refresh fails", async () => {
    const doRequest = vi.fn().mockRejectedValue(new ApiError(401, "expired"));
    const refresh = vi.fn().mockResolvedValue(null);

    await expect(
      requestWithRefresh(doRequest, { accessToken: "access-1", refresh }),
    ).rejects.toMatchObject({ status: 401 });
    expect(doRequest).toHaveBeenCalledOnce();
  });

  it("rethrows when the retried request also returns 401", async () => {
    const doRequest = vi.fn().mockRejectedValue(new ApiError(401, "expired"));
    const refresh = vi.fn().mockResolvedValue("access-2");

    await expect(
      requestWithRefresh(doRequest, { accessToken: "access-1", refresh }),
    ).rejects.toMatchObject({ status: 401 });
    expect(doRequest).toHaveBeenCalledTimes(2);
  });

  it("does not refresh for non-401 errors", async () => {
    const doRequest = vi.fn().mockRejectedValue(new ApiError(403, "forbidden"));
    const refresh = vi.fn();

    await expect(
      requestWithRefresh(doRequest, { accessToken: "access-1", refresh }),
    ).rejects.toMatchObject({ status: 403 });
    expect(refresh).not.toHaveBeenCalled();
  });
});
