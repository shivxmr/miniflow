import { cn } from "@/lib/cn";

export interface LogoProps {
  /** `ink` for light surfaces, `light` for dark surfaces. */
  tone?: "ink" | "light";
  className?: string;
}

/** The MiniFlow wordmark: a small board glyph paired with the product name. */
export function Logo({ tone = "ink", className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-[0.55rem] bg-accent text-white shadow-sm">
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2.5" width="3.1" height="11" rx="1.3" fill="currentColor" />
          <rect x="6.45" y="2.5" width="3.1" height="6.5" rx="1.3" fill="currentColor" />
          <rect
            x="10.9"
            y="2.5"
            width="3.1"
            height="8.75"
            rx="1.3"
            fill="currentColor"
            fillOpacity="0.68"
          />
        </svg>
      </span>
      <span
        className={cn(
          "font-display text-xl font-semibold tracking-tight",
          tone === "light" ? "text-paper" : "text-ink",
        )}
      >
        MiniFlow
      </span>
    </span>
  );
}
