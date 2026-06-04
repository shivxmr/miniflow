import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Label } from "@/lib/types";

import { LabelPillList } from "./label-pill";

function makeLabels(count: number): Label[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    project_id: "p1",
    name: `label-${i}`,
    color: "#2563EB",
  }));
}

describe("LabelPillList", () => {
  it("renders a pill for each label when under the limit", () => {
    render(<LabelPillList labels={makeLabels(3)} />);
    expect(screen.getByText("label-0")).toBeInTheDocument();
    expect(screen.getByText("label-1")).toBeInTheDocument();
    expect(screen.getByText("label-2")).toBeInTheDocument();
  });

  it("shows the first three then a +N more indicator", () => {
    render(<LabelPillList labels={makeLabels(5)} />);
    expect(screen.getByText("label-0")).toBeInTheDocument();
    expect(screen.getByText("label-2")).toBeInTheDocument();
    expect(screen.queryByText("label-3")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("lists the hidden labels in the +N more tooltip", () => {
    render(<LabelPillList labels={makeLabels(5)} />);
    expect(screen.getByText("+2 more")).toHaveAttribute(
      "title",
      "label-3, label-4",
    );
  });

  it("renders nothing when there are no labels", () => {
    const { container } = render(<LabelPillList labels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
