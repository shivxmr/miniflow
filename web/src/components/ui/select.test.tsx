import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./select";

const OPTIONS = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
];

describe("Select", () => {
  it("renders a labelled select with its options", () => {
    render(<Select label="Fruit" options={OPTIONS} defaultValue="a" />);

    expect(screen.getByLabelText("Fruit")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
  });

  it("calls onChange when a different option is picked", async () => {
    const onChange = vi.fn();
    render(
      <Select label="Fruit" options={OPTIONS} value="a" onChange={onChange} />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Fruit"), "b");
    expect(onChange).toHaveBeenCalled();
  });

  it("marks the field invalid and shows an error message", () => {
    render(<Select label="Fruit" options={OPTIONS} error="Required" />);

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Fruit")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
