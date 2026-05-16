import { type ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-paper">
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}
