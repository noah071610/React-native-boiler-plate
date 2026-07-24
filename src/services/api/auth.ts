import { clearTokens, getRefreshToken, setTokens } from '@/lib/secure';

/**
 * App auth transport. Talks to the backend's plain Hono auth routes
 * (`/api/auth/google | /refresh | /logout`) which return JSON tokens — no cookies.
 * Tokens are stored in the OS keychain via `@/lib/secure`.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Shape mirrors the backend `toSafeUser`. Kept loose for the boilerplate. */
export type AuthUser = { id: string; email: string } & Record<string, unknown>;

type TokenResponse = { accessToken: string; refreshToken: string; user: AuthUser };

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Exchange a Google ID token for our session; persists tokens, returns the user. */
export async function googleLogin(idToken: string): Promise<AuthUser> {
  const res = await postJson('/api/auth/google', { idToken });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? 'google_login_failed');
  }
  const data = (await res.json()) as TokenResponse;
  await setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

// Single-flight: concurrent 401s share one refresh call instead of stampeding.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Rotate tokens using the stored refresh token.
 * Returns the new access token, or null if the session is gone (caller signs out).
 */
export function refreshSession(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await postJson('/api/auth/refresh', { refreshToken });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = (await res.json()) as TokenResponse;
  await setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

/** Best-effort server logout + local token wipe. */
export async function logoutRequest(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await postJson('/api/auth/logout', { refreshToken }).catch(() => undefined);
  }
  await clearTokens();
}
