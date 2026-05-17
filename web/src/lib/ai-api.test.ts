import { describe, expect, it, vi } from "vitest";

import type { AuthedRequest } from "./api";
import { summarizeProject } from "./ai-api";

describe("ai-api", () => {
  it("summarizeProject POSTs to the project summary endpoint", async () => {
    const fn = vi.fn().mockResolvedValue({ summary: "On track." });
    const request = fn as unknown as AuthedRequest;

    const result = await summarizeProject(request, "p1");

    expect(fn).toHaveBeenCalledWith("/projects/p1/ai/summary", {
      method: "POST",
    });
    expect(result).toBe("On track.");
  });
});
