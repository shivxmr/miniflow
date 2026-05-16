"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { requestWithRefresh } from "@/lib/api";
import {
  type LoginInput,
  type SignupInput,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  signup as signupRequest,
} from "@/lib/auth-api";
import {
  type StoredSession,
  clearSession,
  loadSession,
  saveSession,
} from "@/lib/token-store";
import type { User } from "@/lib/types";

/**
 * `loading`  — restoring a session from storage; nothing should render yet.
 * `authenticated` / `unauthenticated` — resolved state.
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Access the auth state and actions. Must be used within an {@link AuthProvider}. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Owns the authentication session: token storage, the current user, and
 * silent refresh of expired access tokens.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  /** Live token pair, read by refresh/logout without stale closures. */
  const sessionRef = useRef<StoredSession | null>(null);

  const applySession = useCallback((session: StoredSession) => {
    sessionRef.current = session;
    saveSession(session);
  }, []);

  const endSession = useCallback(() => {
    sessionRef.current = null;
    clearSession();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  /**
   * Exchanges the stored refresh token for a fresh pair. Returns the new
   * access token, or `null` (and ends the session) when refresh fails.
   */
  const refresh = useCallback(async (): Promise<string | null> => {
    const session = sessionRef.current;
    if (!session) {
      return null;
    }
    try {
      const tokens = await refreshSession(session.refreshToken);
      const next: StoredSession = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
      applySession(next);
      return next.accessToken;
    } catch {
      endSession();
      return null;
    }
  }, [applySession, endSession]);

  // Restore a session from storage on first mount, validating it against /me.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const stored = loadSession();
      if (!stored) {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
        return;
      }
      sessionRef.current = stored;
      try {
        const currentUser = await requestWithRefresh(
          (token) => fetchCurrentUser(token ?? ""),
          { accessToken: stored.accessToken, refresh },
        );
        if (!cancelled) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          endSession();
        }
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [refresh, endSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const tokens = await loginRequest(input);
      applySession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      const currentUser = await fetchCurrentUser(tokens.access_token);
      setUser(currentUser);
      setStatus("authenticated");
    },
    [applySession],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      await signupRequest(input);
      await login({ email: input.email, password: input.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    const session = sessionRef.current;
    if (session) {
      try {
        await logoutRequest(session.refreshToken, session.accessToken);
      } catch {
        // Revoking server-side is best-effort; always clear locally.
      }
    }
    endSession();
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, signup, logout }),
    [status, user, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
