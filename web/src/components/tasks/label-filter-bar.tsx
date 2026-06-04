"use client";

import { cn } from "@/lib/cn";
import { readableTextColor } from "@/lib/label-colors";
import type { Label } from "@/lib/types";

interface LabelFilterBarProps {
  labels: Label[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

/**
 * A row of clickable label chips that filter the board. Selecting several
 * matches tasks carrying any of them (OR logic, applied server-side).
 */
export function LabelFilterBar({
  labels,
  selectedIds,
  onChange,
  className,
}: LabelFilterBarProps) {
  const selected = new Set(selectedIds);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted">Filter:</span>
      {labels.map((label) => {
        const isOn = selected.has(label.id);
        return (
          <button
            key={label.id}
            type="button"
            aria-pressed={isOn}
            onClick={() => toggle(label.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              isOn
                ? "border-transparent"
                : "border-line text-muted hover:text-ink",
            )}
            style={
              isOn
                ? { backgroundColor: label.color, color: readableTextColor(label.color) }
                : undefined
            }
          >
            {!isOn && (
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: label.color }}
              />
            )}
            {label.name}
          </button>
        );
      })}
      {selectedIds.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
