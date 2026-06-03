import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "./auth-context";
import { LoginForm } from "./login-form";

const { searchParamsMock } = vi.hoisted(() => ({
  searchParamsMock: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParamsMock.value,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADA = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  role: "member",
  created_at: "2026-01-01T00:00:00Z",
};

function renderLoginForm() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  searchParamsMock.value = new URLSearchParams();
});

describe("LoginForm", () => {
  it("shows validation errors and skips the request when fields are empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderLoginForm();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderLoginForm();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits valid credentials to the API", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/login")) {
        return Promise.resolve(
          jsonResponse({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "bearer",
          }),
        );
      }
      if (url.endsWith("/me")) {
        return Promise.resolve(jsonResponse(ADA));
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLoginForm();
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).endsWith("/login")),
      ).toBe(true);
    });
  });

  it("offers a forgot-password link", () => {
    renderLoginForm();

    expect(
      screen.getByRole("link", { name: /forgot password/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("shows a confirmation toast after a password reset redirect", async () => {
    searchParamsMock.value = new URLSearchParams("reset=1");

    renderLoginForm();

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(
      screen.getByText("Please log in with your new password."),
    ).toBeInTheDocument();
  });

  it("shows a server error when the credentials are rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ detail: "Invalid email or password" }, 401),
        ),
      ),
    );

    renderLoginForm();
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
  });
});
