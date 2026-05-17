import { describe, expect, it, vi } from "vitest";

import type { AuthedRequest } from "./api";
import { generateTaskDrafts, summarizeProject } from "./ai-api";

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

  it("generateTaskDrafts POSTs the text and returns the drafts", async () => {
    const drafts = [
      { title: "Build login form", description: "", priority: "high" },
    ];
    const fn = vi.fn().mockResolvedValue({ drafts });
    const request = fn as unknown as AuthedRequest;

    const result = await generateTaskDrafts(request, "p1", "make a login page");

    expect(fn).toHaveBeenCalledWith("/projects/p1/ai/tasks", {
      method: "POST",
      body: { text: "make a login page" },
    });
    expect(result).toEqual(drafts);
  });
});
