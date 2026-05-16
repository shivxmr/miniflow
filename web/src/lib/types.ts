/** Shared API types mirroring the backend response schemas. */

export type UserRole = "admin" | "member" | "viewer";

/** A user account, as returned by `/me` and `/signup`. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

/** An access/refresh token pair, as returned by `/login` and `/refresh`. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
