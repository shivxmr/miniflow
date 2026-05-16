import { type SelectHTMLAttributes, forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  /** Visible field label. Omit for inline selects and pass `aria-label`. */
  label?: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Validation message; shown in place of the hint and marks it invalid. */
  error?: string | null;
  options: SelectOption[];
}

/** A labelled native `<select>` with a custom chevron and error states. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, ...props },
  ref,
) {
  const id = useId();
  const describedById = `${id}-desc`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? describedById : undefined}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border bg-surface pl-3.5 pr-9",
            "text-sm text-ink transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper",
            "disabled:cursor-not-allowed disabled:opacity-55",
            hasError
              ? "border-danger focus:ring-danger/40"
              : "border-line-strong focus:border-accent focus:ring-accent/35",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
        >
          <path
            d="M5 7.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
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
