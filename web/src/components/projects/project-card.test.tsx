import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/lib/types";
import { ProjectCard } from "./project-card";

const PROJECT: Project = {
  id: "p1",
  name: "Website redesign",
  description: "Refresh the marketing site",
  created_by: "u1",
  created_at: "2026-01-15T12:00:00Z",
  role: "admin",
};

describe("ProjectCard", () => {
  it("renders the project name, the caller's role, and a link to its page", () => {
    render(<ProjectCard project={PROJECT} />);

    expect(screen.getByText("Website redesign")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p1");
  });

  it("shows placeholder text when the project has no description", () => {
    render(<ProjectCard project={{ ...PROJECT, description: null }} />);
    expect(screen.getByText("No description yet.")).toBeInTheDocument();
  });
});
