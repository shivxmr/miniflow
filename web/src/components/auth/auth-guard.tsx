"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "./auth-context";

/** A full-viewport loader shown while the session resolves or a redirect runs. */
function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <Spinner size={30} label="Loading" className="text-accent" />
    </div>
  );
}

/**
 * Wraps protected app routes. Unauthenticated visitors are redirected to
 * `/login`; nothing protected renders until the session is confirmed.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return <FullPageLoader />;
  }
  return <>{children}</>;
}

/**
 * Wraps the auth routes (`/login`, `/signup`). Already-authenticated users are
 * redirected to the dashboard so they never see the sign-in screens.
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status !== "unauthenticated") {
    return <FullPageLoader />;
  }
  return <>{children}</>;
}
