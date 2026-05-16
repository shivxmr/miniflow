import { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** A pulsing placeholder block used to build loading states. */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-line", className)}
      {...props}
    />
  );
}
