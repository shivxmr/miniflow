import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("associates its label with the input element", () => {
    render(<Input label="Email" />);

    expect(screen.getByLabelText("Email")).toBeInstanceOf(HTMLInputElement);
  });

  it("shows an error message and marks the field invalid", () => {
    render(<Input label="Email" error="Email is required" />);

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("shows a hint when there is no error", () => {
    render(<Input label="Password" hint="At least 8 characters" />);

    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
  });

  it("hides the hint once an error is present", () => {
    render(
      <Input
        label="Password"
        hint="At least 8 characters"
        error="Password is too short"
      />,
    );

    expect(
      screen.queryByText("At least 8 characters"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Password is too short")).toBeInTheDocument();
  });
});
