"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** localStorage key holding the user's explicit theme choice. */
export const THEME_STORAGE_KEY = "miniflow-theme";

const SunIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * A sun/moon button that toggles dark mode. The choice is written to
 * localStorage and applied via `data-theme` on <html>; an inline script in
 * the root layout restores it before first paint to avoid a flash.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  // Reflect the theme the no-flash script already applied on <html>. This must
  // run after mount (not during render) so the server-rendered "light" markup
  // matches on hydration; the DOM read then corrects it without a flash.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to DOM state set pre-hydration
    setTheme(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the toggle still works.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-surface text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
