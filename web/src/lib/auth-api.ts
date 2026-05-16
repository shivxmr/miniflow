/** Typed wrappers for the MiniFlow authentication endpoints. */

import { apiFetch } from "./api";
import type { TokenPair, User } from "./types";

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Creates a new account. Returns the created user (not a session). */
export function signup(input: SignupInput): Promise<User> {
  return apiFetch<User>("/signup", { method: "POST", body: input });
}

/** Exchanges credentials for an access/refresh token pair. */
export function login(input: LoginInput): Promise<TokenPair> {
  return apiFetch<TokenPair>("/login", { method: "POST", body: input });
}

/** Rotates the refresh token, returning a fresh token pair. */
export function refreshSession(refreshToken: string): Promise<TokenPair> {
  return apiFetch<TokenPair>("/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

/** Revokes the refresh token server-side. */
export function logout(
  refreshToken: string,
  accessToken: string,
): Promise<void> {
  return apiFetch<void>("/logout", {
    method: "POST",
    body: { refresh_token: refreshToken },
    token: accessToken,
  });
}

/** Loads the account for the given access token. */
export function fetchCurrentUser(accessToken: string): Promise<User> {
  return apiFetch<User>("/me", { token: accessToken });
}
