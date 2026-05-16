import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";
import { Card } from "./card";
import { Spinner } from "./spinner";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Project summary</Card>);

    expect(screen.getByText("Project summary")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge tone="success">Done</Badge>);

    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("exposes an accessible status when given a label", () => {
    render(<Spinner label="Loading projects" />);

    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Loading projects",
    );
  });
});
