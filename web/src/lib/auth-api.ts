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

export interface MessageResponse {
  message: string;
}

/**
 * Requests a password-reset link. The response is always the same neutral
 * message regardless of whether the email is registered (no enumeration).
 */
export function forgotPassword(email: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

/** Redeems a reset token and sets a new password. */
export function resetPassword(
  token: string,
  newPassword: string,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: { token, new_password: newPassword },
  });
}
