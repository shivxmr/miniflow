"use client";

import { useAuth } from "@/components/auth/auth-context";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Dashboard</p>
      <h1 className="mt-1.5 font-display text-4xl leading-tight tracking-tight text-ink">
        Welcome back, {user?.name ?? "there"}.
      </h1>
      <p className="mt-2 max-w-prose text-muted">
        You are signed in to your MiniFlow workspace. Projects and task boards
        land here next.
      </p>

      <Card className="mt-8 flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
            <rect x="9.5" y="4" width="5" height="10" rx="1.6" fill="currentColor" />
            <rect
              x="16"
              y="4"
              width="5"
              height="13"
              rx="1.6"
              fill="currentColor"
              fillOpacity="0.6"
            />
          </svg>
        </span>
        <h2 className="font-display text-xl text-ink">Your projects, soon</h2>
        <p className="max-w-sm text-sm text-muted">
          Creating projects, inviting teammates, and the task board are coming
          in the next steps of the build.
        </p>
      </Card>
    </div>
  );
}
