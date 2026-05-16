import { type ReactNode } from "react";

import { Button } from "./button";

interface EmptyStateProps {
  /** Optional glyph shown in a soft accent tile. */
  icon?: ReactNode;
  title: string;
  description: string;
  /** Optional call-to-action (typically a Button). */
  action?: ReactNode;
}

/** A friendly placeholder for "there is nothing here yet" situations. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center">
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          {icon}
        </span>
      )}
      <h3 className="font-display text-xl text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description: string;
  /** When provided, renders a "Try again" button. */
  onRetry?: () => void;
}

/** A recoverable error panel, typically shown when a fetch fails. */
export function ErrorState({
  title = "We hit a snag",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-16 text-center shadow-card">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8.5v5M12 16.5h.01M10.3 4.3 3 16.8A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.7-3.2L13.7 4.3a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h3 className="font-display text-xl text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
