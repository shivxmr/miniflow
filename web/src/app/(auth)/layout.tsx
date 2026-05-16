import { type ReactNode } from "react";

import { GuestGuard } from "@/components/auth/auth-guard";
import { Logo } from "@/components/brand/logo";

/** Decorative faux task rows shown on the brand panel. */
const PREVIEW_ROWS = [
  { label: "Draft the launch brief", dot: "bg-success", tag: "Done" },
  { label: "Review board permissions", dot: "bg-warning", tag: "In progress" },
  { label: "Invite the design team", dot: "bg-faint", tag: "Todo" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <GuestGuard>
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Form column */}
        <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
          <Logo />
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-sm">{children}</div>
          </div>
          <p className="text-xs text-faint">
            © 2026 MiniFlow — a lightweight project workspace.
          </p>
        </div>

        {/* Brand column */}
        <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-accent/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
          />

          <span className="relative text-xs font-medium uppercase tracking-[0.22em] text-paper/45">
            Project workspace
          </span>

          <div className="relative max-w-md">
            <h2 className="font-display text-[2.6rem] leading-[1.08] tracking-tight text-paper">
              Plan the work,
              <br />
              then <span className="text-accent">flow</span> through it.
            </h2>
            <p className="mt-5 leading-relaxed text-paper/55">
              Projects, task boards, and team roles in one calm place — so
              everyone always knows what comes next.
            </p>

            <div className="mt-10 rounded-2xl border border-paper/10 bg-paper/[0.04] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="font-display text-base text-paper">
                  Launch checklist
                </span>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                  3 tasks
                </span>
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {PREVIEW_ROWS.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center gap-3 rounded-lg bg-paper/[0.04] px-3 py-2.5"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dot}`}
                    />
                    <span className="flex-1 text-sm text-paper/80">
                      {row.label}
                    </span>
                    <span className="text-xs text-paper/40">{row.tag}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="relative text-sm text-paper/40">
            Built for small teams that move fast.
          </p>
        </aside>
      </div>
    </GuestGuard>
  );
}
