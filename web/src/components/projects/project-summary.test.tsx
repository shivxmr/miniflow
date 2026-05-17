import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, type AuthedRequest } from "@/lib/api";

import { ProjectSummary } from "./project-summary";

const requestMock = vi.fn();
const request = requestMock as unknown as AuthedRequest;

afterEach(() => {
  requestMock.mockReset();
});

describe("ProjectSummary", () => {
  it("renders the trigger button", () => {
    render(<ProjectSummary request={request} projectId="p1" />);

    expect(
      screen.getByRole("button", { name: /Summarize progress/i }),
    ).toBeInTheDocument();
  });

  it("opens a modal and shows the AI summary", async () => {
    requestMock.mockResolvedValue({
      summary: "Three tasks done, two in progress.",
    });
    render(<ProjectSummary request={request} projectId="p1" />);

    await userEvent.click(
      screen.getByRole("button", { name: /Summarize progress/i }),
    );

    expect(
      await screen.findByText("Three tasks done, two in progress."),
    ).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith("/projects/p1/ai/summary", {
      method: "POST",
    });
  });

  it("shows a loading state while the summary is generated", async () => {
    requestMock.mockReturnValue(new Promise(() => {}));
    render(<ProjectSummary request={request} projectId="p1" />);

    await userEvent.click(
      screen.getByRole("button", { name: /Summarize progress/i }),
    );

    expect(await screen.findByText(/Generating/i)).toBeInTheDocument();
  });

  it("shows a friendly error and retries when the request fails", async () => {
    requestMock.mockRejectedValueOnce(
      new ApiError(502, "The AI service is unavailable. Please try again."),
    );
    render(<ProjectSummary request={request} projectId="p1" />);

    await userEvent.click(
      screen.getByRole("button", { name: /Summarize progress/i }),
    );

    expect(
      await screen.findByText(
        "The AI service is unavailable. Please try again.",
      ),
    ).toBeInTheDocument();

    requestMock.mockResolvedValueOnce({ summary: "Now it works." });
    await userEvent.click(screen.getByRole("button", { name: /Try again/i }));

    await waitFor(() =>
      expect(screen.getByText("Now it works.")).toBeInTheDocument(),
    );
  });
});
