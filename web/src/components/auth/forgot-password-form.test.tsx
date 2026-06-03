import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ForgotPasswordForm", () => {
  it("renders the email form", () => {
    render(<ForgotPasswordForm />);

    expect(
      screen.getByRole("heading", { name: /forgot your password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i }),
    ).toBeInTheDocument();
  });

  it("validates the email and skips the request when invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgotPasswordForm />);
    await userEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the neutral confirmation after a successful request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse({ message: "If an account exists…" })),
      ),
    );

    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /check your email/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
  });

  it("surfaces a server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse({ detail: "Too many requests" }, 429)),
      ),
    );

    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many requests",
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /check your email/i }),
      ).not.toBeInTheDocument(),
    );
  });
});
