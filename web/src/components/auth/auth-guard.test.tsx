import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, replaceMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("./auth-context", () => ({ useAuth: useAuthMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { AuthGuard, GuestGuard } from "./auth-guard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthGuard", () => {
  it("renders protected content for an authenticated user", () => {
    useAuthMock.mockReturnValue({ status: "authenticated", user: {} });

    render(
      <AuthGuard>
        <p>Protected content</p>
      </AuthGuard>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated user to /login", () => {
    useAuthMock.mockReturnValue({ status: "unauthenticated", user: null });

    render(
      <AuthGuard>
        <p>Protected content</p>
      </AuthGuard>,
    );

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("shows a loading state while the session is resolving", () => {
    useAuthMock.mockReturnValue({ status: "loading", user: null });

    render(
      <AuthGuard>
        <p>Protected content</p>
      </AuthGuard>,
    );

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("GuestGuard", () => {
  it("renders the auth screen for an unauthenticated visitor", () => {
    useAuthMock.mockReturnValue({ status: "unauthenticated", user: null });

    render(
      <GuestGuard>
        <p>Sign-in screen</p>
      </GuestGuard>,
    );

    expect(screen.getByText("Sign-in screen")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects an authenticated user to the dashboard", () => {
    useAuthMock.mockReturnValue({ status: "authenticated", user: {} });

    render(
      <GuestGuard>
        <p>Sign-in screen</p>
      </GuestGuard>,
    );

    expect(screen.queryByText("Sign-in screen")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });
});
