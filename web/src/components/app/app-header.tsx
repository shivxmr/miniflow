"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-context";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** The persistent top bar for authenticated app routes. */
export function AppHeader() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await logout();
    // The AuthGuard redirects to /login once the session ends.
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/dashboard"
          aria-label="MiniFlow dashboard"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink"
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-medium text-ink">
                  {user.name}
                </span>
                <span className="block text-xs capitalize text-muted">
                  {user.role}
                </span>
              </span>
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={signingOut}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
