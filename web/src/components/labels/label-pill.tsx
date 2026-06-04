"use client";

import { cn } from "@/lib/cn";
import { readableTextColor } from "@/lib/label-colors";
import type { Label } from "@/lib/types";

interface LabelPillProps {
  label: Label;
  /** When provided, renders a small × that calls this with the label. */
  onRemove?: (label: Label) => void;
  className?: string;
}

/** A single colored label pill, with optional remove affordance. */
export function LabelPill({ label, onRemove, className }: LabelPillProps) {
  const textColor = readableTextColor(label.color);
  return (
    <span
      className={cn(
        "inline-flex max-w-[10rem] items-center gap-1 rounded-full px-2 py-0.5",
        "text-xs font-medium tracking-tight",
        className,
      )}
      style={{ backgroundColor: label.color, color: textColor }}
    >
      <span className="truncate">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove label ${label.name}`}
          onClick={() => onRemove(label)}
          className="-mr-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full opacity-70 transition-opacity hover:opacity-100"
          style={{ color: textColor }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path
              d="M1 1l6 6M7 1L1 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

interface LabelPillListProps {
  labels: Label[];
  /** How many pills to show before collapsing the rest into "+N more". */
  max?: number;
  className?: string;
}

/** A row of label pills, truncated to `max` with a "+N more" indicator. */
export function LabelPillList({ labels, max = 3, className }: LabelPillListProps) {
  if (labels.length === 0) return null;

  const visible = labels.slice(0, max);
  const hidden = labels.slice(max);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((label) => (
        <LabelPill key={label.id} label={label} />
      ))}
      {hidden.length > 0 && (
        <span
          title={hidden.map((label) => label.name).join(", ")}
          className="inline-flex items-center rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-muted"
        >
          +{hidden.length} more
        </span>
      )}
    </div>
  );
}
