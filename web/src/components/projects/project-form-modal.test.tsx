import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { ProjectFormModal } from "./project-form-modal";

describe("ProjectFormModal", () => {
  it("requires a project name before submitting", async () => {
    const onSubmit = vi.fn();
    render(
      <ProjectFormModal
        open
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Create project" }),
    );

    expect(screen.getByText("Project name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a trimmed name and a null description when blank", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectFormModal
        open
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(
      screen.getByLabelText("Project name"),
      "  New site  ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create project" }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "New site",
        description: null,
      }),
    );
  });

  it("pre-fills the fields in edit mode", () => {
    render(
      <ProjectFormModal
        open
        mode="edit"
        initial={{ name: "Existing project", description: "A description" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Project name")).toHaveValue(
      "Existing project",
    );
    expect(screen.getByLabelText("Description")).toHaveValue("A description");
  });

  it("surfaces a server error returned by onSubmit", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "A project with that name exists"));
    render(
      <ProjectFormModal
        open
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText("Project name"), "Duplicate");
    await userEvent.click(
      screen.getByRole("button", { name: "Create project" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A project with that name exists",
    );
  });
});
