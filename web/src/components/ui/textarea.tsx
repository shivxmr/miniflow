import { type TextareaHTMLAttributes, forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Validation message; shown in place of the hint and marks it invalid. */
  error?: string | null;
}

/** A labelled multi-line text field with inline hint and error states. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, className, rows = 4, ...props }, ref) {
    const id = useId();
    const describedById = `${id}-desc`;
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? describedById : undefined}
          className={cn(
            "resize-y rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink",
            "placeholder:text-faint transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper",
            hasError
              ? "border-danger focus:ring-danger/40"
              : "border-line-strong focus:border-accent focus:ring-accent/35",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={describedById} className="text-sm text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={describedById} className="text-sm text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
