import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { AuthedRequest } from "@/lib/api";
import type { Label } from "@/lib/types";

import { ManageLabelsModal } from "./manage-labels-modal";

const LABELS: Label[] = [
  { id: "l1", project_id: "p1", name: "bug", color: "#E11D48" },
  { id: "l2", project_id: "p1", name: "chore", color: "#2563EB" },
];

function renderModal(labels: Label[] = LABELS) {
  const requestMock = vi.fn().mockResolvedValue({});
  const onChanged = vi.fn();
  render(
    <ToastProvider>
      <ManageLabelsModal
        open
        onClose={vi.fn()}
        projectId="p1"
        request={requestMock as unknown as AuthedRequest}
        labels={labels}
        onChanged={onChanged}
      />
    </ToastProvider>,
  );
  return { requestMock, onChanged };
}

describe("ManageLabelsModal", () => {
  it("lists the existing labels", () => {
    renderModal();
    expect(screen.getByDisplayValue("bug")).toBeInTheDocument();
    expect(screen.getByDisplayValue("chore")).toBeInTheDocument();
  });

  it("creates a label with the typed name and a chosen color", async () => {
    const user = userEvent.setup();
    const { requestMock, onChanged } = renderModal();
    requestMock.mockResolvedValue({
      id: "l3",
      project_id: "p1",
      name: "frontend",
      color: "#9333EA",
    });

    await user.type(screen.getByLabelText(/new label name/i), "frontend");
    await user.click(screen.getByRole("button", { name: /^purple$/i }));
    await user.click(screen.getByRole("button", { name: /add label/i }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith("/projects/p1/labels", {
        method: "POST",
        body: { name: "frontend", color: "#9333EA" },
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("renames an existing label", async () => {
    const user = userEvent.setup();
    const { requestMock } = renderModal();

    const input = screen.getByDisplayValue("bug");
    await user.clear(input);
    await user.type(input, "defect");
    const row = input.closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith("/projects/p1/labels/l1", {
        method: "PUT",
        body: { name: "defect", color: "#E11D48" },
      }),
    );
  });

  it("deletes a label after confirmation", async () => {
    const user = userEvent.setup();
    const { requestMock } = renderModal();

    const row = screen.getByDisplayValue("bug").closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /delete label/i }));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith("/projects/p1/labels/l1", {
        method: "DELETE",
      }),
    );
  });
});
