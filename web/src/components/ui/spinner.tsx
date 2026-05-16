import { cn } from "@/lib/cn";

export interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  className?: string;
  /** Accessible label; when set the spinner is announced as a status. */
  label?: string;
}

/** A small indeterminate loading indicator that inherits the current color. */
export function Spinner({ size = 18, className, label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={cn("inline-flex shrink-0", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin-slow"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
