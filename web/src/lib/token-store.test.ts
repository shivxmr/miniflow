import { afterEach, describe, expect, it } from "vitest";

import { clearSession, loadSession, saveSession } from "./token-store";

afterEach(() => {
  localStorage.clear();
});

describe("session storage", () => {
  it("returns null when no session is stored", () => {
    expect(loadSession()).toBeNull();
  });

  it("round-trips a saved session", () => {
    saveSession({ accessToken: "access-1", refreshToken: "refresh-1" });

    expect(loadSession()).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("clears a stored session", () => {
    saveSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    clearSession();

    expect(loadSession()).toBeNull();
  });

  it("returns null when the stored value is not valid JSON", () => {
    localStorage.setItem("miniflow.session", "{ broken");

    expect(loadSession()).toBeNull();
  });

  it("returns null when the stored session is missing a token", () => {
    localStorage.setItem(
      "miniflow.session",
      JSON.stringify({ accessToken: "access-1" }),
    );

    expect(loadSession()).toBeNull();
  });
});
