import { hc } from 'hono/client';
import { AppType } from './../../../../lightbase-online/src/index';

import { getToken } from '@/lib/secure';
import { refreshSession } from '@/services/api/auth';

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!baseUrl && __DEV__) {
  console.warn('EXPO_PUBLIC_API_URL is not set — see .env.example');
}

function withAuth(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Custom fetch: attaches the bearer access token and, on a 401, transparently
 * rotates tokens once and retries. If refresh fails the 401 propagates so the
 * caller (auth store) can sign the user out.
 */
const authFetch: typeof fetch = async (input, init) => {
  const token = await getToken();
  const res = await fetch(input, withAuth(init, token));
  if (res.status !== 401) return res;

  const newToken = await refreshSession();
  if (!newToken) return res;
  return fetch(input, withAuth(init, newToken));
};

export const api = hc<AppType>(baseUrl ?? '', { fetch: authFetch });
