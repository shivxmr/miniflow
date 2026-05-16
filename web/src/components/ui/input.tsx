import { type InputHTMLAttributes, forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Validation message; shown in place of the hint and marks the field invalid. */
  error?: string | null;
}

/** A labelled text field with inline hint and error states. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, ...props },
  ref,
) {
  const id = useId();
  const describedById = `${id}-desc`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-ink"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={hasError || undefined}
        aria-describedby={hint || error ? describedById : undefined}
        className={cn(
          "h-11 rounded-lg border bg-surface px-3.5 text-sm text-ink",
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
});
