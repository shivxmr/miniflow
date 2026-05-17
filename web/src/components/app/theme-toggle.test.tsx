import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY, ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("starts in light mode and switches to dark on click", async () => {
    render(<ThemeToggle />);

    await userEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("toggles back to light mode on a second click", async () => {
    render(<ThemeToggle />);

    await userEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("reflects an already-dark document on mount", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });
});
