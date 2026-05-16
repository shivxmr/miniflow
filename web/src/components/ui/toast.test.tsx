import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type ToastOptions, ToastProvider, useToast } from "./toast";

function NotifyButton(props: { options: ToastOptions }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(props.options)}>Notify</button>;
}

describe("Toast", () => {
  it("shows a toast when one is triggered", async () => {
    render(
      <ToastProvider>
        <NotifyButton
          options={{ tone: "success", title: "Project saved", duration: 0 }}
        />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("Notify"));

    expect(screen.getByText("Project saved")).toBeInTheDocument();
  });

  it("auto-dismisses a toast after its duration", async () => {
    render(
      <ToastProvider>
        <NotifyButton
          options={{ tone: "info", title: "Quick note", duration: 60 }}
        />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("Notify"));
    expect(screen.getByText("Quick note")).toBeInTheDocument();

    await waitForElementToBeRemoved(() => screen.queryByText("Quick note"));
  });

  it("dismisses a toast when its dismiss button is clicked", async () => {
    render(
      <ToastProvider>
        <NotifyButton
          options={{ tone: "success", title: "Project saved", duration: 0 }}
        />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("Notify"));
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("Project saved")).not.toBeInTheDocument();
  });

  it("throws when useToast is used outside a provider", () => {
    function Orphan() {
      useToast();
      return null;
    }

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/);
    consoleError.mockRestore();
  });
});
