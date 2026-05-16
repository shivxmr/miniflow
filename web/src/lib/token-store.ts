/**
 * Persists the auth session (access + refresh tokens) in `localStorage` so
 * the user stays signed in across reloads. The auth provider is the only
 * caller; UI code should never touch tokens directly.
 */

const STORAGE_KEY = "miniflow.session";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

function isStoredSession(value: unknown): value is StoredSession {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredSession).accessToken === "string" &&
    typeof (value as StoredSession).refreshToken === "string"
  );
}

/** Reads the stored session, or `null` when absent or corrupt. */
export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persists the session, replacing any previous value. */
export function saveSession(session: StoredSession): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/** Removes the stored session (used on logout and on refresh failure). */
export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
