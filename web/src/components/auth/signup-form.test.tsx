import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-context";
import { SignupForm } from "./signup-form";

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

function renderSignupForm() {
  return render(
    <AuthProvider>
      <SignupForm />
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SignupForm", () => {
  it("shows validation errors and skips the request when fields are empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderSignupForm();
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the minimum password length", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderSignupForm();
    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    expect(
      screen.getByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a valid new account to the API", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/signup")) {
        return Promise.resolve(jsonResponse(ADA, 201));
      }
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

    renderSignupForm();
    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret12");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).endsWith("/signup")),
      ).toBe(true);
    });
  });

  it("shows a server error when the email is already registered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ detail: "Email is already registered" }, 409),
        ),
      ),
    );

    renderSignupForm();
    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret12");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email is already registered",
    );
  });
});
