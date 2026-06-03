import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replaceMock, searchParamsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchParamsMock: { value: new URLSearchParams("token=reset-token-123") },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsMock.value,
}));

import { ResetPasswordForm } from "./reset-password-form";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  searchParamsMock.value = new URLSearchParams("token=reset-token-123");
});

describe("ResetPasswordForm", () => {
  it("renders the password fields when a token is present", () => {
    render(<ResetPasswordForm />);

    expect(
      screen.getByRole("heading", { name: /set a new password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("shows an invalid-link state and a recovery link when the token is missing", () => {
    searchParamsMock.value = new URLSearchParams();

    render(<ResetPasswordForm />);

    expect(
      screen.getByRole("heading", { name: /invalid reset link/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a new link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("rejects a password shorter than 8 characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "short");
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(
      screen.getByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flags mismatched passwords", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "secret124",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to login with the reset flag on success", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ message: "Password updated." })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "secret123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/login?reset=1"),
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/reset-password$/);
    expect(JSON.parse(String(options?.body))).toEqual({
      token: "reset-token-123",
      new_password: "secret123",
    });
  });

  it("shows a server error for an expired or used token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            { detail: "This reset link is invalid or has expired." },
            400,
          ),
        ),
      ),
    );

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "secret123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This reset link is invalid or has expired.",
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
