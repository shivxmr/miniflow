import { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** A raised surface used to group related content. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}
