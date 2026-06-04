"use client";

import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { AuthedRequest } from "@/lib/api";
import { addTaskLabel, removeTaskLabel } from "@/lib/labels-api";
import type { Label, Task } from "@/lib/types";

const MAX_LABELS = 5;

interface LabelPickerProps {
  request: AuthedRequest;
  task: Task;
  /** Every label defined on the task's project. */
  projectLabels: Label[];
  /** Called with the task returned by the API after a label is added/removed. */
  onTaskChange: (task: Task) => void;
}

/**
 * A popover that toggles a task's labels, saving each change instantly via the
 * task-label endpoints. Any writer may use it on any task.
 */
export function LabelPicker({
  request,
  task,
  projectLabels,
  onTaskChange,
}: LabelPickerProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const appliedIds = new Set(task.labels.map((label) => label.id));
  const atCap = task.labels.length >= MAX_LABELS;

  async function toggle(label: Label) {
    const applied = appliedIds.has(label.id);
    if (!applied && atCap) return;
    setBusyId(label.id);
    try {
      const updated = applied
        ? await removeTaskLabel(request, task.id, label.id)
        : await addTaskLabel(request, task.id, label.id);
      onTaskChange(updated);
    } catch (caught) {
      showToast({
        title: applied ? "Could not remove label" : "Could not add label",
        description: errorMessage(caught),
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Labels"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2 3.5A1.5 1.5 0 0 1 3.5 2H8l6 6-4.5 4.5a1.5 1.5 0 0 1-2.1 0L2 7V3.5z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="5.25" cy="5.25" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Apply labels"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop"
        >
          {projectLabels.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">
              No labels in this project yet.
            </p>
          ) : (
            projectLabels.map((label) => {
              const selected = appliedIds.has(label.id);
              const disabled = (!selected && atCap) || busyId === label.id;
              return (
                <button
                  key={label.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  onClick={() => !disabled && toggle(label)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-sunken"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {label.name}
                  </span>
                  {selected && (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="shrink-0 text-accent"
                    >
                      <path
                        d="M3 8.5l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
