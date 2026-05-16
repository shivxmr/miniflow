/**
 * Typed API client for the MiniFlow backend.
 *
 * Responsibilities:
 *  - prefix requests with the API base URL from the environment
 *  - serialize/parse JSON bodies
 *  - normalize FastAPI error shapes into a single `ApiError`
 *
 * Token attachment and 401 auto-refresh live in the auth provider, which
 * wraps `apiFetch` — see src/components/auth/auth-context.tsx.
 */

const FALLBACK_MESSAGES: Record<number, string> = {
  400: "Please check your input and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to do that.",
  404: "We could not find what you were looking for.",
  409: "That conflicts with something that already exists.",
  422: "Please check your input and try again.",
};

function fallbackMessage(status: number): string {
  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }
  return FALLBACK_MESSAGES[status] ?? "The request could not be completed.";
}

/** A single FastAPI validation error item from a 422 `detail` array. */
interface ValidationDetail {
  loc?: unknown[];
  msg?: string;
}

/**
 * Error thrown for any non-2xx API response.
 * `fieldErrors` maps a form field name to its message (populated for 422s).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Extracts a user-facing message from any thrown value. */
export function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.message;
  }
  return "Something went wrong. Please try again.";
}

function fieldNameFromLoc(loc: unknown[] | undefined): string | null {
  if (!Array.isArray(loc)) {
    return null;
  }
  const segments = loc.filter(
    (part): part is string => typeof part === "string" && part !== "body",
  );
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

/** Converts a raw HTTP status + parsed body into a structured `ApiError`. */
export function normalizeError(status: number, body: unknown): ApiError {
  const detail =
    body && typeof body === "object"
      ? (body as { detail?: unknown }).detail
      : undefined;

  if (typeof detail === "string" && detail.trim()) {
    return new ApiError(status, detail);
  }

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as ValidationDetail[]) {
      const message = item?.msg;
      if (typeof message !== "string") {
        continue;
      }
      const field = fieldNameFromLoc(item?.loc);
      if (field && !(field in fieldErrors)) {
        fieldErrors[field] = message;
      }
    }
    const firstMessage = (detail[0] as ValidationDetail)?.msg;
    const message =
      typeof firstMessage === "string" ? firstMessage : fallbackMessage(status);
    return new ApiError(status, message, fieldErrors);
  }

  return new ApiError(status, fallbackMessage(status));
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export interface ApiRequestOptions {
  method?: string;
  /** Plain object serialized as a JSON request body. */
  body?: unknown;
  /** Access token attached as `Authorization: Bearer <token>`. */
  token?: string | null;
  signal?: AbortSignal;
}

/** Options for an authenticated request; the token is supplied by the caller. */
export type AuthedRequestOptions = Omit<ApiRequestOptions, "token">;

/**
 * A bound request function that attaches the current access token and retries
 * once through silent refresh on a 401. Exposed by the auth provider as
 * `useAuth().request` — see src/components/auth/auth-context.tsx.
 */
export type AuthedRequest = <T>(
  path: string,
  options?: AuthedRequestOptions,
) => Promise<T>;

/** Reads a response body as JSON, tolerating empty or non-JSON payloads. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Performs a single HTTP request against the MiniFlow API.
 *
 * Resolves with the parsed JSON body (or `undefined` for 204 responses) and
 * rejects with an {@link ApiError} for network failures and non-2xx responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  const headers = new Headers();
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      0,
      "Unable to reach the server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw normalizeError(response.status, await readJson(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await readJson(response)) as T;
}

/**
 * Runs an authenticated request with transparent 401 recovery.
 *
 * Calls `doRequest` with the current access token. If it fails with a 401,
 * `refresh` is invoked once; on success the request is retried with the new
 * token, otherwise the original error is rethrown. This is the mechanism
 * behind the auth provider's "silent refresh" behaviour.
 */
export async function requestWithRefresh<T>(
  doRequest: (token: string | null) => Promise<T>,
  ctx: {
    accessToken: string | null;
    refresh: () => Promise<string | null>;
  },
): Promise<T> {
  try {
    return await doRequest(ctx.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    const refreshedToken = await ctx.refresh();
    if (!refreshedToken) {
      throw error;
    }
    return doRequest(refreshedToken);
  }
}
