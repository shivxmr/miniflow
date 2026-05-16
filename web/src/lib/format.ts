/** Small presentation-layer formatting helpers. */

/** Formats an ISO timestamp as a short, human date like "May 17, 2026". */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Returns the uppercase first letter of a name, for use in avatars. */
export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
