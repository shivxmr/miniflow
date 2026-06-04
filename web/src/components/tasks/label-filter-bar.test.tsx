import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Label } from "@/lib/types";

import { LabelFilterBar } from "./label-filter-bar";

const LABELS: Label[] = [
  { id: "l1", project_id: "p1", name: "bug", color: "#E11D48" },
  { id: "l2", project_id: "p1", name: "chore", color: "#2563EB" },
];

describe("LabelFilterBar", () => {
  it("selects a label when its chip is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LabelFilterBar labels={LABELS} selectedIds={[]} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /bug/i }));

    expect(onChange).toHaveBeenCalledWith(["l1"]);
  });

  it("deselects a label that is already selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LabelFilterBar labels={LABELS} selectedIds={["l1"]} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /bug/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("marks selected chips as pressed", () => {
    render(
      <LabelFilterBar labels={LABELS} selectedIds={["l1"]} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /bug/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /chore/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clears all selected labels", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LabelFilterBar
        labels={LABELS}
        selectedIds={["l1", "l2"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /clear/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
