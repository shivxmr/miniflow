import { describe, expect, it } from "vitest";

import { formatDate, initial } from "./format";

describe("formatDate", () => {
  it("formats an ISO timestamp as a short human date", () => {
    expect(formatDate("2026-05-17T12:00:00Z")).toMatch(
      /^[A-Z][a-z]{2} \d{1,2}, 2026$/,
    );
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatDate("not-a-date")).toBe("");
  });
});

describe("initial", () => {
  it("returns the uppercase first letter of a name", () => {
    expect(initial("ada lovelace")).toBe("A");
    expect(initial("  grace")).toBe("G");
  });

  it("falls back to a placeholder for an empty name", () => {
    expect(initial("")).toBe("?");
  });
});
