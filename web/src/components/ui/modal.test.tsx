import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./modal";

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Edit project">
        <p>Project body</p>
      </Modal>,
    );

    expect(screen.queryByText("Project body")).not.toBeInTheDocument();
  });

  it("renders a labelled dialog while open", () => {
    render(
      <Modal open onClose={() => {}} title="Edit project">
        <p>Project body</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Edit project");
    expect(screen.getByText("Project body")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit project">
        <p>Project body</p>
      </Modal>,
    );

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit project">
        <p>Project body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByTestId("modal-backdrop"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when content inside the panel is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit project">
        <p>Project body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByText("Project body"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes via the close button", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit project">
        <p>Project body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
