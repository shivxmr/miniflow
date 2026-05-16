import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useResource } from "./use-resource";

describe("useResource", () => {
  it("starts in a loading state, then resolves with data", async () => {
    const { result } = renderHook(() =>
      useResource(() => Promise.resolve("hello"), []),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("hello");
    expect(result.current.error).toBeNull();
  });

  it("captures an error when the loader rejects", async () => {
    const { result } = renderHook(() =>
      useResource(() => Promise.reject(new Error("boom")), []),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("re-runs the loader when reload is called", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const { result } = renderHook(() => useResource(loader, []));

    await waitFor(() => expect(result.current.data).toBe("first"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
